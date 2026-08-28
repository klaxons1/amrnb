package amr;

/**
 * Math helper functions, ported from opencore-amr 0.1.6 common/src:
 *   gmed_n.cpp, inv_sqrt.cpp, log2_norm.cpp, log2.cpp, pow2.cpp, sqrt_l.cpp
 * (via src/common/mathops.js of the JS reference port).
 * C output pointers (Word16 *exponent, ...) become short[1] parameters so
 * call sites read like the C code. gmed_n uses shared temp buffers exactly
 * like the JS module-level Int16Arrays.
 */
public final class Mathops {
    private Mathops() {}

    private static final int NMAX = 9; /* largest N used in median calculation */
    private static final short[] gmedTmp = new short[NMAX];
    private static final short[] gmedTmp2 = new short[NMAX];

    /** gmed_n.cpp gmed_n — median of ind[indOff .. indOff+n-1] */
    public static int gmed_n(short[] ind, int indOff, int n) {
        int ix = 0;
        int max;
        final short[] tmp = gmedTmp;
        final short[] tmp2 = gmedTmp2;

        for (int i = 0; i < n; i++) {
            tmp2[i] = ind[indOff + i];
        }

        for (int i = 0; i < n; i++) {
            max = -32767;
            for (int j = 0; j < n; j++) {
                if (tmp2[j] >= max) {
                    max = tmp2[j];
                    ix = j;
                }
            }
            tmp2[ix] = -32768;
            tmp[i] = (short) ix;
        }

        final int medianIndex = tmp[n >> 1]; /* account for complex addressing */
        return ind[indOff + medianIndex];
    }

    /** inv_sqrt.cpp Inv_sqrt (pOverflow intentionally unused, as in C) */
    public static int Inv_sqrt(int L_x, int[] pOverflow) {
        int exp;
        int i;
        int a;
        int tmp;
        int L_y;

        if (L_x <= 0) {
            return 0x3fffffff;
        }

        exp = Basicop.norm_l(L_x);
        L_x <<= exp; /* L_x is normalize */
        exp = 30 - exp;

        if ((exp & 1) == 0) {
            /* If exponent even -> shift right */
            L_x >>= 1;
        }
        exp >>= 1;
        exp += 1;

        L_x >>= 9;
        i = (L_x >> 16) << 16 >> 16; /* Extract b25-b31 */
        a = (L_x >> 1) << 16 >> 16;  /* Extract b10-b24 */
        a &= 0x7fff;

        i -= 16;

        L_y = Tbls.inv_sqrt_tbl[i] << 16; /* inv_sqrt_tbl[i] << 16 */
        tmp = Tbls.inv_sqrt_tbl[i] - Tbls.inv_sqrt_tbl[i + 1];
        /* always a positive number less than 200 */
        L_y = L_y - ((tmp * a) << 1); /* L_y -= tmp*a*2 */
        L_y >>= exp; /* denormalization, exp always 0< exp < 31 */
        return L_y;
    }

    /**
     * log2_norm.cpp Log2_norm.
     * @param exponent short[1] out
     * @param fraction short[1] out
     */
    public static void Log2_norm(int L_x, int exp, short[] exponent, short[] fraction) {
        int i;
        int a;
        int tmp;
        int L_y;

        if (L_x <= 0) {
            exponent[0] = 0;
            fraction[0] = 0;
        } else {
            /* Calculate exponent portion of Log2 */
            exponent[0] = (short) (30 - exp);

            /* Shift L_x to the right by 10 to extract bits 10-31 */
            L_x >>= 10;
            i = (L_x >> 15) << 16 >> 16; /* Extract b25-b31 */
            a = L_x & 0x7fff;            /* Extract b10-b24 of fraction */

            i -= 32;

            L_y = Tbls.log2_tbl[i] << 16; /* table[i] << 16 */
            tmp = Tbls.log2_tbl[i] - Tbls.log2_tbl[i + 1]; /* table[i] - table[i+1] */
            L_y = L_y - ((tmp * a) << 1); /* L_y -= tmp*a*2 */
            fraction[0] = (short) ((L_y >> 16) << 16 >> 16);
        }
    }

    /**
     * log2.cpp Log2 (pOverflow intentionally unused, as in C).
     * @param pExponent short[1] out
     * @param pFraction short[1] out
     */
    public static void Log2(int L_x, short[] pExponent, short[] pFraction, int[] pOverflow) {
        final int exp = Basicop.norm_l(L_x);
        Log2_norm(L_x << exp, exp, pExponent, pFraction);
    }

    /** pow2.cpp Pow2 */
    public static int Pow2(int exponent, int fraction, int[] pOverflow) {
        int exp;
        int i;
        int a;
        int tmp;
        int L_x;

        L_x = Basicop.L_mult(fraction, 32, pOverflow); /* L_x = fraction<<6 */

        /* Extract b0-b16 of fraction */
        i = ((L_x >> 16) << 16 >> 16) & 31; /* ensure index i is bounded */
        a = ((L_x >> 1) & 0x7fff) << 16 >> 16;

        L_x = Tbls.pow2_tbl[i] << 16; /* pow2_tbl[i] << 16 */
        tmp = Tbls.pow2_tbl[i] - Tbls.pow2_tbl[i + 1];
        L_x = Basicop.L_msu(L_x, tmp, a, pOverflow); /* L_x -= tmp*a*2 */

        exp = 30 - exponent;
        L_x = Basicop.L_shr_r(L_x, exp, pOverflow);

        return L_x;
    }

    /**
     * sqrt_l.cpp sqrt_l_exp.
     * @param pExp short[1] out (right shift to apply to result, Q1)
     */
    public static int sqrt_l_exp(int L_x, short[] pExp, int[] pOverflow) {
        int e;
        int i;
        int a;
        int tmp;
        int L_y;

        if (L_x <= 0) {
            pExp[0] = 0;
            return 0;
        }

        e = Basicop.norm_l(L_x) & 0xfffe; /* get next lower EVEN norm. exp */
        L_x = Basicop.L_shl(L_x, e, pOverflow); /* L_x is normalized to [0.25..1) */
        pExp[0] = (short) e; /* return 2*exponent (or Q1) */

        L_x >>= 10;
        i = ((L_x >> 15) << 16 >> 16) & 63; /* Extract b25-b31, 16<= i <=63 */
        a = (L_x << 16) >> 16; /* Extract b10-b24 */
        a &= 0x7fff;

        if (i > 15) {
            i -= 16; /* 0 <= i <= 47 */
        }

        L_y = Tbls.sqrt_l_tbl[i] << 16; /* sqrt_l_tbl[i] << 16 */
        tmp = Tbls.sqrt_l_tbl[i] - Tbls.sqrt_l_tbl[i + 1];
        L_y = Basicop.L_msu(L_y, tmp, a, pOverflow); /* L_y -= tmp*a*2 */

        /* denormalization done by caller */
        return L_y;
    }
}
