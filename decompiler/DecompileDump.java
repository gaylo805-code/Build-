// DecompileDump.java — Ghidra headless post-script.
// Usage: analyzeHeadless <projdir> <proj> -import <binary> -postScript DecompileDump.java <outdir> -deleteProject -scriptPath <scriptdir>
// Dumps each function's decompiled C into <outdir>/<func>.c + _index.txt listing all functions.
import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;
import java.io.File;
import java.io.FileWriter;

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

        StringBuilder index = new StringBuilder();
        int count = 0, failed = 0;
        FunctionIterator funcs = currentProgram.getFunctionManager().getFunctions(true);
        while (funcs.hasNext() && !monitor.isCancelled()) {
            Function f = funcs.next();
            String name = f.getName() + "@" + f.getEntryPoint().toString();
            DecompileResults res = decomp.decompileFunction(f, 60, monitor);
            if (res != null && res.decompileCompleted()) {
                String safe = f.getName().replaceAll("[^a-zA-Z0-9_.$-]", "_");
                File out = new File(outDir, safe + ".c");
                // Avoid collisions (overloads / same names).
                int dup = 1;
                while (out.exists()) {
                    out = new File(outDir, safe + "__" + (dup++) + ".c");
                }
                try (FileWriter w = new FileWriter(out)) {
                    w.write("// " + name + "\n// addr: " + f.getEntryPoint() + "\n\n");
                    w.write(res.getDecompiledFunction().getC());
                }
                count++;
            } else {
                failed++;
            }
            index.append(f.getEntryPoint()).append("  ").append(name).append("\n");
            if ((count + failed) % 200 == 0) println("DecompileDump: " + (count + failed) + " functions...");
        }
        try (FileWriter w = new FileWriter(new File(outDir, "_index.txt"))) {
            w.write("decompiled=" + count + " failed=" + failed + "\n\n");
            w.write(index.toString());
        }
        println("DecompileDump done: decompiled=" + count + " failed=" + failed);
        decomp.dispose();
    }
}
