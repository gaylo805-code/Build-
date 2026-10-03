// DecompileDump.java — Ghidra headless post-script.
// Usage: analyzeHeadless <projdir> <proj> -import <binary> -postScript DecompileDump.java <outdir> -deleteProject -scriptPath <scriptdir>
// Chỉ tạo đúng 1 file <outdir>/_full.c: toàn bộ hàm đã lọc, đúng thứ tự địa chỉ.
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.File;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class DecompileDump extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length < 1) {
            printerr("DecompileDump: missing output dir arg");
            return;
        }
        File outDir = new File(args[0]);
        outDir.mkdirs();

        DecompInterface decomp = new DecompInterface();
        decomp.openProgram(currentProgram);

        // Giữ lại (địa chỉ, tên, code) để dựng file tổng hợp đúng thứ tự gốc.
        List<String[]> ordered = new ArrayList<>();
        java.util.Map<String, String[]> byName = new java.util.HashMap<>();
        java.util.Map<String, Boolean> isStub = new java.util.HashMap<>();
        int count = 0, failed = 0, done = 0;
        FunctionIterator funcs = currentProgram.getFunctionManager().getFunctions(true);
        while (funcs.hasNext() && !monitor.isCancelled()) {
            Function f = funcs.next();
            // Bỏ hàm thừa: thunk trỏ sang import (stub PLT) và hàm ngoài chương trình.
            if (f.isThunk() || f.isExternal()) {
                continue;
            }
            String name = f.getName() + "@" + f.getEntryPoint().toString();
            DecompileResults res = decomp.decompileFunction(f, 60, monitor);
            if (res != null && res.decompileCompleted()) {
                String code = res.getDecompiledFunction().getC();
                // Bỏ chữ thừa: các dòng cảnh báo của Ghidra (kể cả thụt đầu dòng trong thân hàm).
                code = code.replaceAll("(?m)^[ \\t]*/\\* WARNING[^\\n]*\\*/[ \\t]*\\n?", "");
                // Con trỏ hàm: (code *) -> (code) để biên dịch được với typedef bên dưới.
                code = code.replace("*(code *)", "(code)").replace("(code *)", "(code)");
                // Gán zero cho mảng: X = (T [N])0x0 -> memset (idiom zero mảng của Ghidra).
                code = code.replaceAll("(\\w+)\\s*=\\s*\\(\\s*(?:byte|undefined1?|char|ushort|undefined2|uint|undefined4|ulong|undefined8)\\s*\\[\\d*\\]\\s*\\)\\s*0x0\\s*;",
                                       "memset($1, 0, sizeof($1));");
                // Cast kiểu mảng còn lại: (undefined1 [16])0x0 -> (void *)0x0.
                code = code.replaceAll("\\(\\s*(?:byte|undefined1?|char|ushort|undefined2|uint|undefined4|ulong|undefined8)\\s*\\[\\d*\\]\\s*\\)", "(void *)");
                // Cast số nguyên lẻ byte của Ghidra (int7...) -> ulong.
                code = code.replaceAll("\\bint[35679]\\b", "ulong");
                // entry: "void processEntry entry(" -> "void entry(".
                code = code.replace("processEntry ", "");
                // Zero union: (_union_N)0x0 -> 0.
                code = code.replaceAll("\\(_union_\\d+\\)0x0", "0");
                // Biến khai báo scalar nhưng dùng như struct (v.__member): đổi khai báo
                // thành struct tổng hợp mang các member đó (vd jmp_buf của Ghidra).
                java.util.regex.Pattern memUsePat =
                    java.util.regex.Pattern.compile("\\b([A-Za-z_]\\w*)\\.(__\\w+)");
                java.util.regex.Matcher mu = memUsePat.matcher(code);
                java.util.LinkedHashMap<String, java.util.LinkedHashSet<String>> structMembers =
                    new java.util.LinkedHashMap<>();
                while (mu.find()) {
                    structMembers.computeIfAbsent(mu.group(1), k -> new java.util.LinkedHashSet<>()).add(mu.group(2));
                }
                for (java.util.Map.Entry<String, java.util.LinkedHashSet<String>> se : structMembers.entrySet()) {
                    String base = se.getKey();
                    java.util.regex.Pattern declPat = java.util.regex.Pattern.compile(
                        "(?m)^(\\s*)(?:byte|undefined1?|char|ushort|undefined2|uint|undefined4|ulong|undefined8|long|int)\\s+"
                        + java.util.regex.Pattern.quote(base) + "\\s*;\\s*$");
                    java.util.regex.Matcher dm = declPat.matcher(code);
                    if (!dm.find()) continue;
                    // An toàn: bỏ qua nếu biến còn được dùng như scalar ở chỗ khác
                    // (cho phép &base và base.__member — cả hai đều hợp lệ với struct).
                    String scrubbed = noDecl.replaceAll("&\\s*" + java.util.regex.Pattern.quote(base) + "\\b", "&");
                    scrubbed = scrubbed.replaceAll("\\b" + java.util.regex.Pattern.quote(base) + "\\s*\\.__\\w+", "");
                    java.util.regex.Matcher bare =
                        java.util.regex.Pattern.compile("\\b" + java.util.regex.Pattern.quote(base) + "\\b").matcher(scrubbed);
                    if (bare.find()) continue;
                    StringBuilder sb = new StringBuilder("struct { ");
                    for (String mem : se.getValue()) sb.append("unsigned long ").append(mem).append("; ");
                    sb.append("unsigned long __pad[8]; }");
                    code = dm.replaceFirst(java.util.regex.Matcher.quoteReplacement(dm.group(1) + sb.toString() + " " + base + ";"));
                }
                // (&DAT_x)[i] -> DAT_x[i] (mảng extern không cần &).
                code = code.replaceAll("\\(\\s*&([A-Za-z_]\\w*)\\s*\\)\\[", "$1[");
                // Đánh dấu hàm rỗng/stub (thân chỉ còn return hoặc trống) để lọc sau.
                String body = code.replaceAll("(?s)^.*?\\{", "{").trim();
                boolean stub = body.matches("(?s)\\{\\s*(return\\s*[^;]*;)?\\s*\\}");
                String[] rec = new String[]{f.getEntryPoint().toString(), name, code};
                ordered.add(rec);
                byName.put(f.getName(), rec);
                isStub.put(f.getName(), stub);
                count++;
            } else {
                failed++;
            }
            if ((++done % 200) == 0) println("DecompileDump: " + done + " functions...");
        }
        // Giữ lại stub nào ĐƯỢC HÀM KHÁC GỌI (nếu bỏ sẽ thiếu symbol khi biên dịch).
        java.util.regex.Pattern funRefPat =
            java.util.regex.Pattern.compile("\\b(FUN_[0-9a-fA-F]+)\\s*\\(");
        java.util.LinkedHashSet<String> called = new java.util.LinkedHashSet<>();
        for (String[] e : ordered) {
            java.util.regex.Matcher rm = funRefPat.matcher(e[2]);
            while (rm.find()) called.add(rm.group(1));
        }
        List<String[]> kept = new ArrayList<>();
        for (String[] e : ordered) {
            String fn = e[1].split("@")[0];
            if (!isStub.getOrDefault(fn, false) || called.contains(fn)) kept.add(e);
        }
        ordered = kept;
        count = ordered.size();
        // File duy nhất: cấu trúc như source C gốc — includes, kiểu dữ liệu,
        // khai báo extern cho data của binary, rồi các hàm theo thứ tự địa chỉ.
        ordered.sort(Comparator.comparing(a -> a[0]));
        // Gom các symbol data mà hàm tham chiếu (_DAT_*, _UNK_*, PTR_*) để khai báo extern.
        java.util.LinkedHashSet<String> externs = new java.util.LinkedHashSet<>();
        java.util.regex.Matcher m;
        java.util.regex.Pattern symPat =
            java.util.regex.Pattern.compile("\\b(_DAT_[0-9A-Za-z_]+|DAT_[0-9A-Fa-f_]+|_UNK_[0-9A-Za-z_]+|PTR_[0-9A-Za-z_]+)\\b");
        java.util.regex.Pattern stackPat =
            java.util.regex.Pattern.compile("\\bstack0x[0-9a-fA-F]+\\b");
        java.util.regex.Pattern assignPat =
            java.util.regex.Pattern.compile("\\b(_DAT_[0-9A-Za-z_]+|DAT_[0-9A-Fa-f_]+|_UNK_[0-9A-Za-z_]+|PTR_[0-9A-Za-z_]+)\\s*=[^=]");
        for (String[] e : ordered) {
            m = symPat.matcher(e[2]);
            while (m.find()) externs.add(m.group(1));
        }
        // Stack placeholder của entry (stack0x...) -> extern char để lấy địa chỉ được.
        java.util.LinkedHashSet<String> stackSyms = new java.util.LinkedHashSet<>();
        for (String[] e : ordered) {
            m = stackPat.matcher(e[2]);
            while (m.find()) stackSyms.add(m.group(0));
        }
        // Union ẩn danh của Ghidra (_union_N, thường là jmp_buf) -> typedef tương thích.
        java.util.regex.Pattern unionDeclPat =
            java.util.regex.Pattern.compile("(?m)^\\s*(_union_\\d+)\\s+[A-Za-z_]\\w*\\s*;");
        java.util.LinkedHashSet<String> unionTypes = new java.util.LinkedHashSet<>();
        for (String[] e : ordered) {
            m = unionDeclPat.matcher(e[2]);
            while (m.find()) unionTypes.add(m.group(1));
        }
        // Symbol nào bị gán (=) thì khai báo scalar để gán được; chỗ dùng [i] thì
        // viết lại qua cast. Còn lại khai báo mảng như data gốc.
        java.util.LinkedHashSet<String> scalarSyms = new java.util.LinkedHashSet<>();
        for (String[] e : ordered) {
            m = assignPat.matcher(e[2]);
            while (m.find()) scalarSyms.add(m.group(1));
        }
        for (String[] e : ordered) {
            for (String s : scalarSyms) {
                e[2] = e[2].replaceAll("\\b" + java.util.regex.Pattern.quote(s) + "\\[",
                                       "((unsigned char *)&" + s + ")[");
            }
        }
        try (FileWriter w = new FileWriter(new File(outDir, "_full.c"))) {
            w.write("// FULL DECOMPILATION — " + currentProgram.getName() + "\n");
            w.write("// functions: " + count + " | sorted by entry address (original layout order)\n");
            w.write("// generated by Ghidra " + currentProgram.getLanguageID() + "\n\n");
            w.write("#include <stdbool.h>\n#include <stddef.h>\n#include <stdint.h>\n");
            w.write("#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n");
            w.write("#include <locale.h>\n#include <wchar.h>\n\n");
            w.write("/* Kieu du lieu cua Ghidra -> C chuan */\n");
            w.write("typedef void (*code)();\n");
            w.write("typedef uint8_t byte, undefined, undefined1;\n");
            w.write("typedef uint16_t ushort, undefined2;\n");
            w.write("typedef uint32_t uint, undefined4;\n");
            w.write("typedef uint64_t ulong, undefined8;\n");
            w.write("#define CONCAT11(a,b) ((ushort)((a) << 8 | (b)))\n");
            w.write("#define CONCAT22(a,b) ((uint)((a) << 16 | (b)))\n");
            w.write("#define CONCAT44(a,b) ((((ulong)(a)) << 32) | (b))\n");
            // CONCAT mọi cỡ (vd CONCAT71 của Ghidra): ((ulong)a << 8*M) | b.
            for (int n = 1; n <= 8; n++) for (int mm = 1; mm <= 8; mm++) {
                if ((n == 1 && mm == 1) || (n == 2 && mm == 2) || (n == 4 && mm == 4)) continue;
                w.write("#define CONCAT" + n + mm + "(a,b) (((ulong)(a) << " + (8 * mm) + ") | (b))\n");
            }
            w.write("\n");
            if (!externs.isEmpty() || !stackSyms.isEmpty()) {
                w.write("/* Data cua binary goc */\n");
                for (String s : externs) {
                    if (scalarSyms.contains(s)) w.write("extern unsigned long " + s + ";\n");
                    else w.write("extern unsigned char " + s + "[];\n");
                }
                for (String s : stackSyms) w.write("extern char " + s + ";\n");
                w.write("\n");
            }
            if (!unionTypes.isEmpty()) {
                w.write("/* Union an danh cua Ghidra (thuong la jmp_buf) */\n");
                for (String u : unionTypes) {
                    w.write("typedef union { struct { unsigned long __count; unsigned long __value;");
                    w.write(" unsigned long __pad[6]; }; unsigned long _raw[8]; } " + u + ";\n");
                }
                w.write("\n");
            }
            // Prototype khai báo trước: trích NGUYÊN chữ ký định nghĩa (K&R rỗng sẽ
            // xung đột với tham số byte/short do default promotion). Chỉ nhận dòng
            // chữ ký của định nghĩa hàm (dòng tiếp theo là '{').
            w.write("/* Prototypes (theo thu tu dia chi) */\n");
            java.util.regex.Pattern sigPat =
                java.util.regex.Pattern.compile("(?m)^([A-Za-z_][\\w *]*?)\\s+(FUN_[0-9a-fA-F]+)\\s*(\\([^;{}]*\\))\\s*\\n\\s*\\{");
            for (String[] e : ordered) {
                java.util.regex.Matcher sm = sigPat.matcher(e[2]);
                if (sm.find()) {
                    String params = sm.group(3).replaceAll("\\s+", " ").trim();
                    w.write(sm.group(1).trim() + " " + sm.group(2) + params + ";\n");
                }
            }
            w.write("\n");
            for (String[] e : ordered) {
                w.write("// ================= " + e[1] + " =================\n");
                w.write(e[2]);
                w.write("\n\n");
            }
        }
        println("DecompileDump done: decompiled=" + count + " failed=" + failed);
        decomp.dispose();
    }
}
