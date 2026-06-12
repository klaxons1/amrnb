/* Emits golden outputs of the opencore-amr fixed-point primitives to a binary
 * file. Inputs are derived from an LCG replicated exactly in
 * test/basicop.test.js, so only outputs (int32 LE) + overflow flag (uint8)
 * are stored. The op order and case counts must match the JS test. */
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include "basic_op.h"

/* defined in common/src/{extract_h,extract_l,l_deposit_h,l_deposit_l}.cpp,
 * which ship no headers (the live codec code inlines these as shifts) */
Word16 extract_h(Word32 L_var1);
Word16 extract_l(Word32 L_var1);
Word32 L_deposit_h(Word16 var1);
Word32 L_deposit_l(Word16 var1);

static uint32_t lcg_s = 0x12345678u;
static uint32_t nextu(void) {
    lcg_s = lcg_s * 1664525u + 1013904223u;
    return lcg_s;
}
static Word16 r16(void) { return (Word16)(nextu() >> 16); }
static Word32 r32(void) { return (Word32)nextu(); }
static Word16 rshift(void) { return (Word16)((int)(nextu() % 81u) - 40); }

static const Word16 E16[] = { -32768, -32767, -16384, -1, 0, 1, 2,
                              0x3fff, 0x4000, 0x7ffe, 0x7fff };
#define NE16 ((int)(sizeof(E16)/sizeof(E16[0])))
static const Word32 E32[] = { (Word32)0x80000000, (Word32)0x80000001,
                              -0x40000000, -32768, -1, 0, 1, 32767,
                              0x3fffffff, 0x40000000, 0x7ffffffe, 0x7fffffff };
#define NE32 ((int)(sizeof(E32)/sizeof(E32[0])))

#define NRAND 100000

static FILE *out;
static void emit(Word32 result, Flag ovf) {
    uint8_t rec[5];
    rec[0] = (uint8_t)(result & 0xff);
    rec[1] = (uint8_t)((result >> 8) & 0xff);
    rec[2] = (uint8_t)((result >> 16) & 0xff);
    rec[3] = (uint8_t)((result >> 24) & 0xff);
    rec[4] = (uint8_t)ovf;
    fwrite(rec, 1, 5, out);
}

/* one record per case; ovf reset to 0 before each call */
#define RUN(expr) do { Flag o = 0; Word32 r = (Word32)(expr); emit(r, o); } while (0)

int main(int argc, char *argv[]) {
    int i, j;
    if (argc < 2) { fprintf(stderr, "usage: %s out.bin\n", argv[0]); return 1; }
    out = fopen(argv[1], "wb");
    if (!out) { perror(argv[1]); return 1; }

    /* -- 16x16 -> 16 with overflow: add_16, sub, mult, mult_r ------------- */
    for (i = 0; i < NE16; i++) for (j = 0; j < NE16; j++) {
        Flag o; Word16 a = E16[i], b = E16[j];
        o = 0; { Word32 _r = (Word32)(add_16(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(sub(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(mult(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(mult_r(a, b, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word16 a = r16(), b = r16();
        o = 0; { Word32 _r = (Word32)(add_16(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(sub(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(mult(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(mult_r(a, b, &o)); emit(_r, o); }
    }

    /* -- 16-bit shifts: shl, shr, shr_r ----------------------------------- */
    for (i = 0; i < NE16; i++) for (j = -40; j <= 40; j++) {
        Flag o; Word16 a = E16[i], s = (Word16)j;
        o = 0; { Word32 _r = (Word32)(shl(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(shr(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(shr_r(a, s, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word16 a = r16(), s = rshift();
        o = 0; { Word32 _r = (Word32)(shl(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(shr(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(shr_r(a, s, &o)); emit(_r, o); }
    }

    /* -- 16 -> 16 unary: negate, abs_s, norm_s ---------------------------- */
    for (i = -32768; i <= 32767; i++) { /* exhaustive */
        Word16 a = (Word16)i;
        emit(negate(a), 0);
        emit(abs_s(a), 0);
        emit(norm_s(a), 0);
    }

    /* -- div_s: 0 <= var1 <= var2, var2 > 0 ------------------------------- */
    for (i = 0; i < NRAND; i++) {
        Word16 b = (Word16)((nextu() % 32767u) + 1);   /* 1..32767 */
        Word16 a = (Word16)(nextu() % ((uint32_t)b + 1)); /* 0..b */
        emit(div_s(a, b), 0);
    }

    /* -- 32 -> x unary: extract_h, extract_l, norm_l, pv_round, L_deposit -- */
    for (i = 0; i < NE32; i++) {
        Flag o; Word32 a = E32[i];
        emit(extract_h(a), 0);
        emit(extract_l(a), 0);
        emit(norm_l(a), 0);
        o = 0; { Word32 _r = (Word32)(pv_round(a, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word32 a = r32();
        emit(extract_h(a), 0);
        emit(extract_l(a), 0);
        emit(norm_l(a), 0);
        o = 0; { Word32 _r = (Word32)(pv_round(a, &o)); emit(_r, o); }
    }
    for (i = 0; i < NE16; i++) {
        emit(L_deposit_h(E16[i]), 0);
        emit(L_deposit_l(E16[i]), 0);
    }

    /* -- 32x32 -> 32: L_add, L_sub ----------------------------------------- */
    for (i = 0; i < NE32; i++) for (j = 0; j < NE32; j++) {
        Flag o; Word32 a = E32[i], b = E32[j];
        o = 0; { Word32 _r = (Word32)(L_add(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_sub(a, b, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word32 a = r32(), b = r32();
        o = 0; { Word32 _r = (Word32)(L_add(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_sub(a, b, &o)); emit(_r, o); }
    }

    /* -- L_mult / L_mac / L_msu -------------------------------------------- */
    for (i = 0; i < NE16; i++) for (j = 0; j < NE16; j++) {
        Flag o; Word16 a = E16[i], b = E16[j];
        o = 0; { Word32 _r = (Word32)(L_mult(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_mac((Word32)0x7ffffff0, a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_mac((Word32)0x8000000f, a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_msu((Word32)0x7ffffff0, a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_msu((Word32)0x8000000f, a, b, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word32 acc = r32(); Word16 a = r16(), b = r16();
        o = 0; { Word32 _r = (Word32)(L_mult(a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_mac(acc, a, b, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_msu(acc, a, b, &o)); emit(_r, o); }
    }

    /* -- 32-bit shifts: L_shl, L_shr, L_shr_r ------------------------------ */
    for (i = 0; i < NE32; i++) for (j = -40; j <= 40; j++) {
        Flag o; Word32 a = E32[i]; Word16 s = (Word16)j;
        o = 0; { Word32 _r = (Word32)(L_shl(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_shr(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_shr_r(a, s, &o)); emit(_r, o); }
    }
    for (i = 0; i < NRAND; i++) {
        Flag o; Word32 a = r32(); Word16 s = rshift();
        o = 0; { Word32 _r = (Word32)(L_shl(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_shr(a, s, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(L_shr_r(a, s, &o)); emit(_r, o); }
    }

    /* -- Mpy_32 / Mpy_32_16 / Mac_32 / Mac_32_16 --------------------------- */
    for (i = 0; i < NRAND; i++) {
        Flag o; Word16 h1 = r16(), l1 = r16(), h2 = r16(), l2 = r16();
        Word32 acc = r32();
        o = 0; { Word32 _r = (Word32)(Mpy_32(h1, l1, h2, l2, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(Mpy_32_16(h1, l1, h2, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(Mac_32(acc, h1, l1, h2, l2, &o)); emit(_r, o); }
        o = 0; { Word32 _r = (Word32)(Mac_32_16(acc, h1, l1, h2, &o)); emit(_r, o); }
    }

    /* -- amrnb_fxp_mac/msu_16_by_16bb (wrapping int multiply) -------------- */
    for (i = 0; i < NRAND; i++) {
        Word32 a = (Word32)r16(), b = (Word32)r16(), c = r32();
        emit(amrnb_fxp_mac_16_by_16bb(a, b, c), 0);
        emit(amrnb_fxp_msu_16_by_16bb(a, b, c), 0);
    }

    fclose(out);
    return 0;
}
