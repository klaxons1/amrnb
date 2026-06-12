/*
 * Fixed-point basic operations for AMR-NB, hand-ported from opencore-amr 0.1.6:
 *   .../amr_nb/common/include/basic_op.h
 *   .../amr_nb/common/include/basic_op_c_equivalent.h
 *   .../amr_nb/common/src/{add,sub,shr,mult_r,round,shr_r,div_s,l_shr_r,negate,
 *                          norm_l,norm_s,extract_h,extract_l,l_deposit_h,l_deposit_l}.cpp
 *
 * Conventions (whole project):
 *  - Word32 is a JS number normalized to int32 with `| 0` after every operation
 *    that can leave the int32 range; additions that wrap in C wrap here too.
 *  - Word16 values are kept normalized in [-32768, 32767]; a C `(Word16)` cast
 *    is written as `(x << 16) >> 16`.
 *  - pOverflow is a 1-element Int32Array (or any array-like); functions write
 *    pOverflow[0] = 1 exactly where the C code writes *pOverflow = 1.
 *    Functions whose C source ignores pOverflow (OSCL_UNUSED_ARG) ignore it
 *    here as well — do not "fix" this, bit-exactness depends on it.
 *  - `>>` only (never `>>>`): C arithmetic shifts on negative values must keep
 *    the sign. Shift counts >= 32 rely on identical masking in C(x86)/wasm/JS
 *    only where the C source itself has no guard.
 *  - 16x16 multiplies are exact in doubles (max 2^30) and may use plain `*`;
 *    anything that can exceed 16-bit operands uses Math.imul.
 */

export const MAX_32 = 0x7fffffff;
export const MIN_32 = -0x80000000;
export const MAX_16 = 0x7fff;
export const MIN_16 = -0x8000;

/** basic_op_c_equivalent.h L_add */
export function L_add(L_var1, L_var2, pOverflow) {
  let L_sum = (L_var1 + L_var2) | 0;

  if ((L_var1 ^ L_var2) >= 0) {
    if ((L_sum ^ L_var1) >> 31) {
      L_sum = (L_var1 >> 31) ? MIN_32 : MAX_32;
      pOverflow[0] = 1;
    }
  }
  return L_sum;
}

/** basic_op_c_equivalent.h L_sub */
export function L_sub(L_var1, L_var2, pOverflow) {
  let L_diff = (L_var1 - L_var2) | 0;

  if ((L_var1 ^ L_var2) >> 31) {
    if ((L_diff ^ L_var1) & MIN_32) {
      L_diff = (L_var1 >> 31) ? MIN_32 : MAX_32;
      pOverflow[0] = 1;
    }
  }
  return L_diff;
}

/** basic_op_c_equivalent.h L_mac */
export function L_mac(L_var3, var1, var2, pOverflow) {
  let L_sum;
  const result = var1 * var2;
  if (result !== 0x40000000) {
    L_sum = ((result << 1) + L_var3) | 0;

    /* Check if L_sum and L_var_3 share the same sign */
    if ((L_var3 ^ result) > 0) {
      if ((L_sum ^ L_var3) >> 31) {
        L_sum = (L_var3 >> 31) ? MIN_32 : MAX_32;
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
export function L_mult(var1, var2, pOverflow) {
  let L_product = var1 * var2;

  if (L_product !== 0x40000000) {
    L_product = (L_product << 1) | 0; /* Multiply by 2 */
  } else {
    pOverflow[0] = 1;
    L_product = MAX_32;
  }
  return L_product;
}

/** basic_op_c_equivalent.h L_msu */
export function L_msu(L_var3, var1, var2, pOverflow) {
  let result = L_mult(var1, var2, pOverflow);
  result = L_sub(L_var3, result, pOverflow);
  return result;
}

/** basic_op_c_equivalent.h Mpy_32 (pOverflow intentionally unused, as in C) */
export function Mpy_32(L_var1_hi, L_var1_lo, L_var2_hi, L_var2_lo, pOverflow) {
  let L_product;
  let L_sum;
  let product32;

  L_product = L_var1_hi * L_var2_hi;

  if (L_product !== 0x40000000) {
    L_product = (L_product << 1) | 0;
  } else {
    L_product = MAX_32;
  }

  /* result = mult (L_var1_hi, L_var2_lo, pOverflow); */
  product32 = (L_var1_hi * L_var2_lo) >> 15;

  /* L_product = L_mac (L_product, result, 1, pOverflow); */
  L_sum = (L_product + (product32 << 1)) | 0;

  if ((L_product ^ product32) > 0) {
    if ((L_sum ^ L_product) >> 31) {
      L_sum = (L_product >> 31) ? MIN_32 : MAX_32;
    }
  }

  L_product = L_sum;

  /* result = mult (L_var1_lo, L_var2_hi, pOverflow); */
  product32 = (L_var1_lo * L_var2_hi) >> 15;

  /* L_product = L_mac (L_product, result, 1, pOverflow); */
  L_sum = (L_product + (product32 << 1)) | 0;

  if ((L_product ^ product32) > 0) {
    if ((L_sum ^ L_product) >> 31) {
      L_sum = (L_product >> 31) ? MIN_32 : MAX_32;
    }
  }
  return L_sum;
}

/** basic_op_c_equivalent.h Mpy_32_16 */
export function Mpy_32_16(L_var1_hi, L_var1_lo, var2, pOverflow) {
  let L_product;
  let L_sum;
  let result;

  L_product = L_var1_hi * var2;

  if (L_product !== 0x40000000) {
    L_product = (L_product << 1) | 0;
  } else {
    pOverflow[0] = 1;
    L_product = MAX_32;
  }

  result = (L_var1_lo * var2) >> 15;

  L_sum = (L_product + (result << 1)) | 0;

  if ((L_product ^ result) > 0) {
    if ((L_sum ^ L_product) >> 31) {
      L_sum = (L_product >> 31) ? MIN_32 : MAX_32;
      pOverflow[0] = 1;
    }
  }
  return L_sum;
}

/** basic_op_c_equivalent.h mult */
export function mult(var1, var2, pOverflow) {
  let product = (var1 * var2) >> 15;

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
export function amrnb_fxp_mac_16_by_16bb(L_var1, L_var2, L_var3) {
  return (L_var3 + Math.imul(L_var1, L_var2)) | 0;
}

/** basic_op_c_equivalent.h amrnb_fxp_msu_16_by_16bb (Word32 multiply, wraps) */
export function amrnb_fxp_msu_16_by_16bb(L_var1, L_var2, L_var3) {
  return (L_var3 - Math.imul(L_var1, L_var2)) | 0;
}

/** basic_op.h Mac_32 */
export function Mac_32(L_var3, L_var1_hi, L_var1_lo, L_var2_hi, L_var2_lo, pOverflow) {
  let product;

  L_var3 = L_mac(L_var3, L_var1_hi, L_var2_hi, pOverflow);

  product = mult(L_var1_hi, L_var2_lo, pOverflow);
  L_var3 = L_mac(L_var3, product, 1, pOverflow);

  product = mult(L_var1_lo, L_var2_hi, pOverflow);
  L_var3 = L_mac(L_var3, product, 1, pOverflow);

  return L_var3;
}

/** basic_op.h Mac_32_16 */
export function Mac_32_16(L_var3, L_var1_hi, L_var1_lo, var2, pOverflow) {
  let product;

  L_var3 = L_mac(L_var3, L_var1_hi, var2, pOverflow);

  product = mult(L_var1_lo, var2, pOverflow);
  L_var3 = L_mac(L_var3, product, 1, pOverflow);

  return L_var3;
}

/** basic_op.h negate (also negate.cpp) */
export function negate(var1) {
  return var1 === MIN_16 ? MAX_16 : -var1;
}

/** basic_op.h shl (pOverflow intentionally unused, as in C) */
export function shl(var1, var2, pOverflow) {
  let var_out = 0;

  if (var2 < 0) {
    var2 = -var2;
    if (var2 < 15) {
      var_out = var1 >> var2;
    }
  } else {
    var_out = ((var1 << var2) << 16) >> 16; /* C: (Word16) assignment truncates */
    if (var_out >> var2 !== var1) {
      var_out = (var1 >> 15) ^ MAX_16;
    }
  }
  return var_out;
}

/** basic_op.h L_shl (pOverflow intentionally unused, as in C) */
export function L_shl(L_var1, var2, pOverflow) {
  let L_var_out = 0;

  if (var2 > 0) {
    L_var_out = L_var1 << var2;
    if (L_var_out >> var2 !== L_var1) {
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
export function L_shr(L_var1, var2, pOverflow) {
  let L_var_out = 0;

  if (var2 > 0) {
    if (var2 < 31) {
      L_var_out = L_var1 >> var2;
    }
    /* C: var2 >= 31 intentionally returns 0 (see L_shl note) */
  } else {
    var2 = -var2;

    L_var_out = L_var1 << var2;
    if (L_var_out >> var2 !== L_var1) {
      L_var_out = (L_var1 >> 31) ^ MAX_32;
    }
  }
  return L_var_out;
}

/** basic_op.h abs_s */
export function abs_s(var1) {
  /* C: Word16 y = var1 - (var1 < 0) — 16-bit wrap makes abs_s(-32768) = 32767 */
  let y = ((var1 - (var1 < 0 ? 1 : 0)) << 16) >> 16;
  y = y ^ (y >> 15);
  return y;
}

/** add.cpp add_16 */
export function add_16(var1, var2, pOverflow) {
  let sum = var1 + var2;

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
export function sub(var1, var2, pOverflow) {
  let diff = var1 - var2;

  /* C: if ((UWord32)(diff + 32768) > 0x000FFFF) — unsigned compare */
  if ((diff + 32768) >>> 0 > 0x0000ffff) {
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
export function shr(var1, var2, pOverflow) {
  let result;
  if (var2 !== 0) {
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
      result = ((var1 << var2) << 16) >> 16; /* C: (Word16) assignment truncates */
      if (result >> var2 !== var1) {
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
export function mult_r(var1, var2, pOverflow) {
  let L_product_arr = var1 * var2; /* product */
  L_product_arr = (L_product_arr + 0x00004000) | 0; /* round */
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
export function pv_round(L_var1, pOverflow) {
  L_var1 = L_add(L_var1, 0x00008000, pOverflow);
  return (L_var1 >> 16) << 16 >> 16;
}

/** shr_r.cpp shr_r */
export function shr_r(var1, var2, pOverflow) {
  let var_out;

  if (var2 > 15) {
    var_out = 0;
  } else {
    var_out = shr(var1, var2, pOverflow);
    if (var2 > 0) {
      if ((var1 & (1 << (var2 - 1))) !== 0) {
        var_out++;
      }
    }
  }
  return var_out;
}

/** div_s.cpp div_s */
export function div_s(var1, var2) {
  let var_out = 0;
  let iteration;
  let L_num;
  let L_denom;
  let L_denom_by_2;
  let L_denom_by_4;

  if (var1 > var2 || var1 < 0) {
    return 0; /* C: used to exit(0) */
  }
  if (var1) {
    if (var1 !== var2) {
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
export function L_shr_r(L_var1, var2, pOverflow) {
  let result;

  if (var2 > 31) {
    result = 0;
  } else {
    result = L_shr(L_var1, var2, pOverflow);
    if (var2 > 0) {
      if ((L_var1 & (1 << (var2 - 1))) !== 0) {
        result = (result + 1) | 0;
      }
    }
  }
  return result;
}

/** norm_l.cpp norm_l */
export function norm_l(L_var1) {
  let var_out = 0;

  if (L_var1) {
    /* C: Word32 y = L_var1 - (L_var1 < 0) — wraps at MIN_32 */
    const y = (L_var1 - (L_var1 < 0 ? 1 : 0)) | 0;
    L_var1 = y ^ (y >> 31);
    while (!(0x40000000 & L_var1)) {
      var_out++;
      if (0x20000000 & L_var1) {
        break;
      }
      var_out++;
      if (0x10000000 & L_var1) {
        break;
      }
      var_out++;
      if (0x08000000 & L_var1) {
        break;
      }
      var_out++;
      L_var1 <<= 4;
    }
  }
  return var_out;
}

/** norm_s.cpp norm_s */
export function norm_s(var1) {
  let var_out = 0;

  if (var1) {
    /* C: Word16 y = var1 - (var1 < 0) — 16-bit wrap at -32768 */
    const y = ((var1 - (var1 < 0 ? 1 : 0)) << 16) >> 16;
    var1 = y ^ (y >> 15);
    while (!(0x4000 & var1)) {
      var_out++;
      if (0x2000 & var1) {
        break;
      }
      var_out++;
      if (0x1000 & var1) {
        break;
      }
      var_out++;
      if (0x0800 & var1) {
        break;
      }
      var_out++;
      var1 <<= 4;
    }
  }
  return var_out;
}

/** extract_h.cpp */
export function extract_h(L_var1) {
  return ((L_var1 >> 16) << 16) >> 16;
}

/** extract_l.cpp */
export function extract_l(L_var1) {
  return (L_var1 << 16) >> 16;
}

/** l_deposit_h.cpp */
export function L_deposit_h(var1) {
  return (var1 << 16) | 0;
}

/** l_deposit_l.cpp */
export function L_deposit_l(var1) {
  return var1 | 0;
}
