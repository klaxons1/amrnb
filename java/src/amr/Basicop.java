package amr;

/**
 * Fixed-point basic operations for AMR-NB, ported from opencore-amr 0.1.6
 * (via src/common/basicop.js of the JS reference port):
 *   .../amr_nb/common/include/basic_op.h
 *   .../amr_nb/common/include/basic_op_c_equivalent.h
 *   .../amr_nb/common/src/{add,sub,shr,mult_r,round,shr_r,div_s,l_shr_r,negate,
 *                          norm_l,norm_s,extract_h,extract_l,l_deposit_h,l_deposit_l}.cpp
 *
 * Conventions (whole project):
 *  - Word32 is a Java int normalized by the same expressions the JS port uses
 *    (`| 0` after every operation that can leave the int32 range; Java int
 *    arithmetic wraps mod 2^32 identically).
 *  - Word16 values are kept normalized in [-32768, 32767]; a C `(Word16)` cast
 *    is written as `(x << 16) >> 16`.
 *  - pOverflow is an int[1]; functions write pOverflow[0] = 1 exactly where the
 *    C code writes *pOverflow = 1. Functions whose C source ignores pOverflow
 *    ignore it here as well — do not "fix" this, bit-exactness depends on it.
 *  - `>>` only (never `>>>`): C arithmetic shifts on negative values must keep
 *    the sign. Shift counts >= 32 rely on identical masking (low 5 bits) in
 *    C(x86)/wasm/JS/Java only where the C source itself has no guard.
 *  - 16x16 multiplies are exact in both double and int (max 2^30); anything
 *    with wider operands mirrors the JS `Math.imul` (== Java int multiply).
 */
public final class Basicop {
    private Basicop() {}

    public static final int MAX_32 = 0x7fffffff;
    public static final int MIN_32 = -0x80000000;
    public static final int MAX_16 = 0x7fff;
    public static final int MIN_16 = -0x8000;

    /** ECMAScript ToInt32(double): truncate toward zero, wrap mod 2^32. */
    static int toInt32(double d) {
        if (d != d || d == 0.0 || d == -0.0 || Double.isInfinite(d)) {
            return 0;
        }
        double m = d % 4294967296.0; /* IEEE % is exact for integral doubles */
        if (m < 0) {
            m += 4294967296.0;
        }
        return (int) m;
    }

    /** basic_op_c_equivalent.h L_add */
    public static int L_add(int L_var1, int L_var2, int[] pOverflow) {
        int L_sum = L_var1 + L_var2;

        if ((L_var1 ^ L_var2) >= 0) {
            if (((L_sum ^ L_var1) >> 31) != 0) {
                L_sum = (L_var1 >> 31) != 0 ? MIN_32 : MAX_32;
                pOverflow[0] = 1;
            }
        }
        return L_sum;
    }

    /** basic_op_c_equivalent.h L_sub */
    public static int L_sub(int L_var1, int L_var2, int[] pOverflow) {
        int L_diff = L_var1 - L_var2;

        if (((L_var1 ^ L_var2) >> 31) != 0) {
            if ((L_diff ^ L_var1) != 0 && ((L_diff ^ L_var1) & MIN_32) != 0) {
                L_diff = (L_var1 >> 31) != 0 ? MIN_32 : MAX_32;
                pOverflow[0] = 1;
            }
        }
        return L_diff;
    }

    /** basic_op_c_equivalent.h L_mac */
    public static int L_mac(int L_var3, int var1, int var2, int[] pOverflow) {
        int L_sum;
        int result = var1 * var2; /* 16x16, exact */
        if (result != 0x40000000) {
            L_sum = (result << 1) + L_var3;

            /* Check if L_sum and L_var_3 share the same sign */
            if ((L_var3 ^ result) > 0) {
                if (((L_sum ^ L_var3) >> 31) != 0) {
                    L_sum = (L_var3 >> 31) != 0 ? MIN_32 : MAX_32;
                    pOverflow[0] = 1;
                }
            }
        } else {
            pOverflow[0] = 1;
            L_sum = MAX_32;
        }
        return L_sum;
    }

    /** basic_op_c_equivalent.h L_mult */
    public static int L_mult(int var1, int var2, int[] pOverflow) {
        int L_product = var1 * var2; /* 16x16, exact */

        if (L_product != 0x40000000) {
            L_product <<= 1; /* Multiply by 2 */
        } else {
            pOverflow[0] = 1;
            L_product = MAX_32;
        }
        return L_product;
    }

    /** basic_op_c_equivalent.h L_msu */
    public static int L_msu(int L_var3, int var1, int var2, int[] pOverflow) {
        int result = L_mult(var1, var2, pOverflow);
        result = L_sub(L_var3, result, pOverflow);
        return result;
    }

    /**
     * basic_op_c_equivalent.h Mpy_32 (pOverflow intentionally unused, as in C).
     * The first product is computed in double exactly like the JS port
     * (which uses a plain JS multiply there, not Math.imul).
     */
    public static int Mpy_32(int L_var1_hi, int L_var1_lo, int L_var2_hi, int L_var2_lo, int[] pOverflow) {
        double L_product_d = (double) L_var1_hi * (double) L_var2_hi;
        int L_product;
        int L_sum;
        int product32;

        if (L_product_d != 0x40000000) {
            L_product = toInt32(L_product_d) << 1;
        } else {
            L_product = MAX_32;
        }

        /* result = mult (L_var1_hi, L_var2_lo, pOverflow); */
        product32 = (L_var1_hi * L_var2_lo) >> 15;

        /* L_product = L_mac (L_product, result, 1, pOverflow); */
        L_sum = L_product + (product32 << 1);

        if ((L_product ^ product32) > 0) {
            if (((L_sum ^ L_product) >> 31) != 0) {
                L_sum = (L_product >> 31) != 0 ? MIN_32 : MAX_32;
            }
        }

        L_product = L_sum;

        /* result = mult (L_var1_lo, L_var2_hi, pOverflow); */
        product32 = (L_var1_lo * L_var2_hi) >> 15;

        /* L_product = L_mac (L_product, result, 1, pOverflow); */
        L_sum = L_product + (product32 << 1);

        if ((L_product ^ product32) > 0) {
            if (((L_sum ^ L_product) >> 31) != 0) {
                L_sum = (L_product >> 31) != 0 ? MIN_32 : MAX_32;
            }
        }
        return L_sum;
    }

    /** basic_op_c_equivalent.h Mpy_32_16 */
    public static int Mpy_32_16(int L_var1_hi, int L_var1_lo, int var2, int[] pOverflow) {
        int L_product = L_var1_hi * var2; /* exact, then ToInt32 == int wrap */
        int L_sum;
        int result;

        if (L_product != 0x40000000) {
            L_product <<= 1;
        } else {
            pOverflow[0] = 1;
            L_product = MAX_32;
        }

        result = (L_var1_lo * var2) >> 15;

        L_sum = L_product + (result << 1);

        if ((L_product ^ result) > 0) {
            if (((L_sum ^ L_product) >> 31) != 0) {
                L_sum = (L_product >> 31) != 0 ? MIN_32 : MAX_32;
                pOverflow[0] = 1;
            }
        }
        return L_sum;
    }

    /** basic_op_c_equivalent.h mult */
    public static int mult(int var1, int var2, int[] pOverflow) {
        int product = (var1 * var2) >> 15;

        /* Saturate result (if necessary). */
        /* var1 * var2 >0x00007fff is the only case */
        /* that saturation occurs. */
        if (product > 0x00007fff) {
            pOverflow[0] = 1;
            product = MAX_16;
        }
        return (product << 16) >> 16;
    }

    /** basic_op_c_equivalent.h amrnb_fxp_mac_16_by_16bb (Word32 multiply, wraps) */
    public static int amrnb_fxp_mac_16_by_16bb(int L_var1, int L_var2, int L_var3) {
        return L_var3 + L_var1 * L_var2;
    }

    /** basic_op_c_equivalent.h amrnb_fxp_msu_16_by_16bb (Word32 multiply, wraps) */
    public static int amrnb_fxp_msu_16_by_16bb(int L_var1, int L_var2, int L_var3) {
        return L_var3 - L_var1 * L_var2;
    }

    /** basic_op.h Mac_32 */
    public static int Mac_32(int L_var3, int L_var1_hi, int L_var1_lo, int L_var2_hi, int L_var2_lo, int[] pOverflow) {
        int product;

        L_var3 = L_mac(L_var3, L_var1_hi, L_var2_hi, pOverflow);

        product = mult(L_var1_hi, L_var2_lo, pOverflow);
        L_var3 = L_mac(L_var3, product, 1, pOverflow);

        product = mult(L_var1_lo, L_var2_hi, pOverflow);
        L_var3 = L_mac(L_var3, product, 1, pOverflow);

        return L_var3;
    }

    /** basic_op.h Mac_32_16 */
    public static int Mac_32_16(int L_var3, int L_var1_hi, int L_var1_lo, int var2, int[] pOverflow) {
        int product;

        L_var3 = L_mac(L_var3, L_var1_hi, var2, pOverflow);

        product = mult(L_var1_lo, var2, pOverflow);
        L_var3 = L_mac(L_var3, product, 1, pOverflow);

        return L_var3;
    }

    /** basic_op.h negate (also negate.cpp) */
    public static int negate(int var1) {
        return var1 == MIN_16 ? MAX_16 : -var1;
    }

    /** basic_op.h shl (pOverflow intentionally unused, as in C) */
    public static int shl(int var1, int var2, int[] pOverflow) {
        int var_out = 0;

        if (var2 < 0) {
            var2 = -var2;
            if (var2 < 15) {
                var_out = var1 >> var2;
            }
        } else {
            var_out = (var1 << var2 << 16) >> 16; /* C: (Word16) assignment truncates */
            if (var_out >> var2 != var1) {
                var_out = (var1 >> 15) ^ MAX_16;
            }
        }
        return var_out;
    }

    /** basic_op.h L_shl (pOverflow intentionally unused, as in C) */
    public static int L_shl(int L_var1, int var2, int[] pOverflow) {
        int L_var_out = 0;

        if (var2 > 0) {
            L_var_out = L_var1 << var2;
            if (L_var_out >> var2 != L_var1) {
                L_var_out = (L_var1 >> 31) ^ MAX_32;
            }
        } else {
            var2 = -var2;
            if (var2 < 31) {
                L_var_out = L_var1 >> var2;
            }
            /* C: shifts >= 31 intentionally return the initialized 0, even for
               negative L_var1 (not -1). Bit-exactness depends on this. */
        }
        return L_var_out;
    }

    /** basic_op.h L_shr (pOverflow intentionally unused, as in C) */
    public static int L_shr(int L_var1, int var2, int[] pOverflow) {
        int L_var_out = 0;

        if (var2 > 0) {
            if (var2 < 31) {
                L_var_out = L_var1 >> var2;
            }
            /* C: var2 >= 31 intentionally returns 0 (see L_shl note) */
        } else {
            var2 = -var2;

            L_var_out = L_var1 << var2;
            if (L_var_out >> var2 != L_var1) {
                L_var_out = (L_var1 >> 31) ^ MAX_32;
            }
        }
        return L_var_out;
    }

    /** basic_op.h abs_s */
    public static int abs_s(int var1) {
        /* C: Word16 y = var1 - (var1 < 0) — 16-bit wrap makes abs_s(-32768) = 32767 */
        int y = ((var1 - (var1 < 0 ? 1 : 0)) << 16) >> 16;
        y = y ^ (y >> 15);
        return y;
    }

    /** add.cpp add_16 */
    public static int add_16(int var1, int var2, int[] pOverflow) {
        int sum = var1 + var2;

        /* Saturate result (if necessary). */
        if (sum > 0x00007fff) {
            pOverflow[0] = 1;
            sum = MAX_16;
        } else if (sum < -32768) {
            pOverflow[0] = 1;
            sum = MIN_16;
        }
        return (sum << 16) >> 16;
    }

    /** sub.cpp sub */
    public static int sub(int var1, int var2, int[] pOverflow) {
        int diff = var1 - var2;

        /* C: if ((UWord32)(diff + 32768) > 0x000FFFF) — unsigned compare */
        if (((long) (diff + 32768) & 0xffffffffL) > 0x0000ffffL) {
            if (diff > 0x00007fff) {
                diff = MAX_16;
            } else {
                diff = MIN_16;
            }
            pOverflow[0] = 1;
        }
        return (diff << 16) >> 16;
    }

    /** shr.cpp shr */
    public static int shr(int var1, int var2, int[] pOverflow) {
        int result;
        if (var2 != 0) {
            if (var2 > 0) {
                if (var2 > 15) {
                    var2 = 15;
                }
                result = var1 >> var2;
            } else {
                var2 = -var2; /* Shift right negative is equivalent */
                if (var2 > 15) {
                    var2 = 15;
                }
                result = (var1 << var2 << 16) >> 16; /* C: (Word16) assignment truncates */
                if (result >> var2 != var1) {
                    pOverflow[0] = 1;
                    result = var1 > 0 ? MAX_16 : MIN_16;
                }
            }
        } else {
            result = var1;
        }
        return result;
    }

    /** mult_r.cpp mult_r */
    public static int mult_r(int var1, int var2, int[] pOverflow) {
        int L_product_arr = var1 * var2; /* product */
        L_product_arr += 0x00004000; /* round */
        L_product_arr >>= 15; /* shift */
        /* sign extend when necessary */
        L_product_arr |= -(L_product_arr & 0x00010000);

        /* Saturate result (if necessary). */
        if (L_product_arr > 0x00007fff) {
            pOverflow[0] = 1;
            L_product_arr = MAX_16;
        } else if (L_product_arr < -32768) {
            pOverflow[0] = 1;
            L_product_arr = MIN_16;
        }
        return (L_product_arr << 16) >> 16;
    }

    /** round.cpp pv_round */
    public static int pv_round(int L_var1, int[] pOverflow) {
        L_var1 = L_add(L_var1, 0x00008000, pOverflow);
        return (L_var1 >> 16) << 16 >> 16;
    }

    /** shr_r.cpp shr_r */
    public static int shr_r(int var1, int var2, int[] pOverflow) {
        int var_out;

        if (var2 > 15) {
            var_out = 0;
        } else {
            var_out = shr(var1, var2, pOverflow);
            if (var2 > 0) {
                if ((var1 & (1 << (var2 - 1))) != 0) {
                    var_out++;
                }
            }
        }
        return var_out;
    }

    /** div_s.cpp div_s */
    public static int div_s(int var1, int var2) {
        int var_out = 0;
        int iteration;
        int L_num;
        int L_denom;
        int L_denom_by_2;
        int L_denom_by_4;

        if (var1 > var2 || var1 < 0) {
            return 0; /* C: used to exit(0) */
        }
        if (var1 != 0) {
            if (var1 != var2) {
                L_num = var1;
                L_denom = var2;
                L_denom_by_2 = L_denom << 1;
                L_denom_by_4 = L_denom << 2;
                for (iteration = 5; iteration > 0; iteration--) {
                    var_out <<= 3;
                    L_num <<= 3;
                    if (L_num >= L_denom_by_4) {
                        L_num -= L_denom_by_4;
                        var_out |= 4;
                    }
                    if (L_num >= L_denom_by_2) {
                        L_num -= L_denom_by_2;
                        var_out |= 2;
                    }
                    if (L_num >= L_denom) {
                        L_num -= L_denom;
                        var_out |= 1;
                    }
                }
            } else {
                var_out = MAX_16;
            }
        }
        return var_out;
    }

    /** l_shr_r.cpp L_shr_r */
    public static int L_shr_r(int L_var1, int var2, int[] pOverflow) {
        int result;

        if (var2 > 31) {
            result = 0;
        } else {
            result = L_shr(L_var1, var2, pOverflow);
            if (var2 > 0) {
                if ((L_var1 & (1 << (var2 - 1))) != 0) {
                    result++;
                }
            }
        }
        return result;
    }

    /** norm_l.cpp norm_l */
    public static int norm_l(int L_var1) {
        int var_out = 0;

        if (L_var1 != 0) {
            /* C: Word32 y = L_var1 - (L_var1 < 0) — wraps at MIN_32 */
            int y = L_var1 - (L_var1 < 0 ? 1 : 0);
            L_var1 = y ^ (y >> 31);
            while ((0x40000000 & L_var1) == 0) {
                var_out++;
                if ((0x20000000 & L_var1) != 0) {
                    break;
                }
                var_out++;
                if ((0x10000000 & L_var1) != 0) {
                    break;
                }
                var_out++;
                if ((0x08000000 & L_var1) != 0) {
                    break;
                }
                var_out++;
                L_var1 <<= 4;
            }
        }
        return var_out;
    }

    /** norm_s.cpp norm_s */
    public static int norm_s(int var1) {
        int var_out = 0;

        if (var1 != 0) {
            /* C: Word16 y = var1 - (var1 < 0) — 16-bit wrap at -32768 */
            int y = ((var1 - (var1 < 0 ? 1 : 0)) << 16) >> 16;
            var1 = y ^ (y >> 15);
            while ((0x4000 & var1) == 0) {
                var_out++;
                if ((0x2000 & var1) != 0) {
                    break;
                }
                var_out++;
                if ((0x1000 & var1) != 0) {
                    break;
                }
                var_out++;
                if ((0x0800 & var1) != 0) {
                    break;
                }
                var_out++;
                var1 <<= 4;
            }
        }
        return var_out;
    }

    /** extract_h.cpp */
    public static int extract_h(int L_var1) {
        return (L_var1 >> 16) << 16 >> 16;
    }

    /** extract_l.cpp */
    public static int extract_l(int L_var1) {
        return (L_var1 << 16) >> 16;
    }

    /** l_deposit_h.cpp */
    public static int L_deposit_h(int var1) {
        return var1 << 16;
    }

    /** l_deposit_l.cpp */
    public static int L_deposit_l(int var1) {
        return var1;
    }
}
