#!/bin/sh
# Builds the native reference decoder (and later: vector generators) from the
# opencore-amr-0.1.6 sources, mirroring amrnb/Makefile.am include paths.
set -e
cd "$(dirname "$0")"

OC=../../../opencore-amr-0.1.6
AMR=$OC/opencore/codecs_v2/audio/gsm_amr
DEC=$AMR/amr_nb/dec
COMMON=$AMR/amr_nb/common

# -fwrapv: defined two's-complement wrap on signed overflow, matching wasm/JS
# semantics (plain -O2 lets gcc optimize away saturation branches as UB).
CXXFLAGS="-O2 -fwrapv -fno-strict-aliasing
  -I$OC/oscl
  -I$DEC/src
  -I$COMMON/include
  -I$DEC/include
  -I$AMR/common/dec/include
  -I$AMR/amr_nb/enc/src
  -I$OC/amrnb
  -DDISABLE_AMRNB_ENCODER"

DEC_SRCS="agc amrdecode a_refl b_cn_cod bgnscd c_g_aver d1035pf d2_11pf d2_9pf \
  d3_14pf d4_17pf d8_31pf dec_amr dec_gain dec_input_format_tab dec_lag3 dec_lag6 \
  d_gain_c d_gain_p d_plsf_3 d_plsf_5 d_plsf dtx_dec ec_gains ex_ctrl if2_to_ets \
  int_lsf lsp_avg ph_disp post_pro preemph pstfilt qgain475_tab sp_dec wmf_to_ets"

COMMON_SRCS="add az_lsp bitno_tab bitreorder_tab c2_9pf_tab div_s extract_h extract_l \
  gains_tbl gc_pred get_const_tbls gmed_n gray_tbl grid_tbl int_lpc inv_sqrt \
  inv_sqrt_tbl l_deposit_h l_deposit_l log2 log2_norm log2_tbl lsfwt l_shr_r lsp_az \
  lsp lsp_lsf lsp_lsf_tbl lsp_tab mult_r negate norm_l norm_s overflow_tbl \
  ph_disp_tab pow2 pow2_tbl pred_lt q_plsf_3 q_plsf_3_tbl q_plsf_5 q_plsf_5_tbl \
  q_plsf qua_gain_tbl reorder residu round set_zero shr shr_r sqrt_l sqrt_l_tbl sub \
  syn_filt weight_a window_tab"

SRCS="$OC/amrnb/wrapper.cpp"
for f in $DEC_SRCS;    do SRCS="$SRCS $DEC/src/$f.cpp"; done
for f in $COMMON_SRCS; do SRCS="$SRCS $COMMON/src/$f.cpp"; done

g++ $CXXFLAGS $SRCS -x c amrnb-dec-raw.c -o amrnb-dec-raw
echo "built: tools/native/amrnb-dec-raw"

BASICOP_SRCS=""
for f in add sub shr mult_r round shr_r div_s l_shr_r norm_l norm_s \
         extract_h extract_l l_deposit_h l_deposit_l; do
  BASICOP_SRCS="$BASICOP_SRCS $COMMON/src/$f.cpp"
done
g++ $CXXFLAGS $BASICOP_SRCS -x c++ basicop-vectors.c -o basicop-vectors
echo "built: tools/native/basicop-vectors"
