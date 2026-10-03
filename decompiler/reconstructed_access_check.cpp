// reconstructed_access_check.cpp — viết lại từ Ghidra _full.c (binary ELF x86-64, stripped).
// Hành vi gốc: không in gì cả; exit code 1 = "access denied", 0 = key hợp lệ.
//   - Bỏ: _DT_INIT/_FINI_0/entry/PLT thunk/hàm external/hàm rỗng/WARNING/SSO-memcpy boilerplate.
//   - FNV-1a (FUN_001015a0) giữ lại dạng static (trong binary gốc không còn chỗ gọi).
// LƯU Ý TRUNG THỰC (2 điểm không khôi phục được từ bản dịch, cần re-upload file .bin):
//   [1] KEY: tham số thứ 2 của FUN_001012c0 được truyền qua thanh ghi, bản dịch
//       không cho biết giá trị. Điền vào `-DKEY=...` hoặc sửa biến `key` dưới main.
//   [2] 16 byte đầu của bảng mã (rodata _DAT_00102020) nằm trong file binary gốc,
//       đã bị xóa sau khi dịch. 8 byte cuối là hằng số đã khôi phục. Xem kEncoded.
#include <cstdio>
#include <string>

static unsigned int fmix32(unsigned int v) {
    v ^= v >> 16;
    v *= 0x7feb352du;
    v ^= v >> 15;
    v *= 0x85ebca6bu;
    return v ^ (v >> 16);
}

static unsigned int fnv1a_hash(const char *s) {
    unsigned int h = 0x811c9dc5u;
    while (*s)
        h = (h ^ (unsigned char)*s++) * 0x1000193u;
    return h;
}

// Bảng 24 byte mã hóa: 16 byte đầu từ rodata của binary gốc (CHƯA CÓ — cần trích
//  từ file .bin), 8 byte cuối là hằng số có sẵn trong code (0x5d0b1b0a1c185d0b).
static const unsigned char kEncoded[24] = {
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // <-- trích từ binary gốc
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // <-- trích từ binary gốc
    0x0b, 0x5d, 0x18, 0x1c, 0x0a, 0x1b, 0x0b, 0x5d
};

static std::string build_message(unsigned int key) {
    if (fmix32(key ^ 0x13579bdfu) != 0x7f4a7c15u)
        return "access denied";
    std::string out;
    out.resize(24);
    for (int i = 0; i < 24; i++)
        out[i] = (char)(kEncoded[i] ^ ((i & 3) + 0x5d));
    unsigned int stream = fmix32((key + 0x9e3779b9u) ^ 0x34567012u) ^ 0xa5a5a5a5u;
    for (int i = 0; i < 24; i++)
        out[i] ^= (char)(stream >> ((i & 3) << 3));
    return out;
}

int main(int argc, char **argv) {
    (void)argv;
    if (argc <= 1)
        return 1;
    unsigned int key = 0; // <-- xem [1]: điền key thật (nghi vấn fnv1a_hash(argv[1]))
    return build_message(key) == "access denied" ? 1 : 0;
}
