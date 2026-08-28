package amr;

/**
 * Phase dispersion, ported from opencore-amr 0.1.6 dec/src/ph_disp.cpp
 * (via src/dec/ph_disp.js of the JS reference port).
 */
public final class PhDisp {
    private PhDisp() {}

    public static final int PHDGAINMEMSIZE = 5;
    public static final int PHDTHR1LTP = 9830;  /* 0.6 in Q14 */
    public static final int PHDTHR2LTP = 14746; /* 0.9 in Q14 */
    public static final int ONFACTPLUS1 = 16384; /* 2.0 in Q13 */
    public static final int ONLENGTH = 2;

    /** ph_disp.h ph_dispState */
    public static final class State {
        public short[] gainMem;
        public int prevState;
        public int prevCbGain;
        public int lockFull;
        public int onset;

        public State() {
            this.gainMem = new short[PHDGAINMEMSIZE];
            reset();
        }

        /** ph_disp.cpp ph_disp_reset */
        public int reset() {
            for (int i = 0; i < PHDGAINMEMSIZE; i++) {
                gainMem[i] = 0;
            }
            this.prevState = 0;
            this.prevCbGain = 0;
            this.lockFull = 0;
            this.onset = 0; /* assume no onset in start */
            return 0;
        }
    }

    /** ph_disp.cpp ph_disp_lock */
    public static void ph_disp_lock(State state) {
        state.lockFull = 1;
    }

    /** ph_disp.cpp ph_disp_release */
    public static void ph_disp_release(State state) {
        state.lockFull = 0;
    }

    private static final short[] innoSav = new short[Cnst.L_SUBFR];
    private static final short[] psPoss = new short[Cnst.L_SUBFR];

    /** ph_disp.cpp ph_disp */
    public static void ph_disp(State state, int mode, short[] x, int xOff, int cbGain, int ltpGain,
                               short[] inno, int innoOff, int pitch_fac, int tmp_shift, int[] pOverflow) {
        int i, i1;
        int tmp1;
        int L_temp;
        int L_temp2;
        int impNr; /* indicator for amount of dispersion/filter used */
        final short[] inno_sav = innoSav;
        final short[] ps_poss = psPoss;
        int nze, nPulse;
        int ppos;
        short[] ph_imp; /* phase dispersion filter table */
        int c_inno_sav;

        /* Update LTP gain memory */
        state.gainMem[4] = state.gainMem[3];
        state.gainMem[3] = state.gainMem[2];
        state.gainMem[2] = state.gainMem[1];
        state.gainMem[1] = state.gainMem[0];
        state.gainMem[0] = (short) ltpGain;

        /* basic adaption of phase dispersion */
        if (ltpGain < PHDTHR2LTP) {
            /* if (ltpGain < 0.9) */
            if (ltpGain > PHDTHR1LTP) {
                /* if (ltpGain > 0.6) */
                impNr = 1; /* medium dispersion */
            } else {
                impNr = 0; /* maximum dispersion */
            }
        } else {
            impNr = 2; /* no dispersion */
        }

        /* onset indicator: onset = (cbGain > onFact * cbGainMem[0]) */
        L_temp = (state.prevCbGain * ONFACTPLUS1) << 1;
        /* (L_temp << 2) calculation with saturation check */
        if (L_temp > 0x1fffffff) {
            pOverflow[0] = 1;
            L_temp = Basicop.MAX_32;
        } else if (L_temp < -536870912) {
            pOverflow[0] = 1;
            L_temp = Basicop.MIN_32;
        } else {
            L_temp <<= 2;
        }
        tmp1 = Basicop.pv_round(L_temp, pOverflow);
        if (cbGain > tmp1) {
            state.onset = ONLENGTH;
        } else if (state.onset > 0) {
            state.onset -= 1;
        }

        /* if not onset, check ltpGain buffer and use max phase dispersion if
           half or more of the ltpGain-parameters say so */
        if (state.onset == 0) {
            i1 = 0;
            for (i = 0; i < PHDGAINMEMSIZE; i++) {
                if (state.gainMem[i] < PHDTHR1LTP) {
                    i1 += 1;
                }
            }
            if (i1 > 2) {
                impNr = 0;
            }
        }

        /* Restrict decrease in phase dispersion to one step if not onset */
        if (impNr > state.prevState + 1 && state.onset == 0) {
            impNr -= 1;
        }
        /* if onset, use one step less phase dispersion */
        if (impNr < 2 && state.onset > 0) {
            impNr += 1;
        }
        /* disable for very low levels */
        if (cbGain < 10) {
            impNr = 2;
        }
        if (state.lockFull == 1) {
            impNr = 0;
        }

        /* update static memory */
        state.prevState = impNr;
        state.prevCbGain = cbGain;

        /* do phase dispersion for all modes but 12.2, 10.2 and 7.4;
           don't modify the innovation if impNr >= 2 (= no phase disp) */
        if (mode != Cnst.MR122 && mode != Cnst.MR102 && mode != Cnst.MR74 && impNr < 2) {
            /* track pulse positions, save innovation, initialize new innovation */
            nze = 0;
            for (i = 0; i < Cnst.L_SUBFR; i++) {
                if (inno[innoOff + i] != 0) {
                    ps_poss[nze] = (short) i;
                    nze += 1;
                }
                inno_sav[i] = inno[innoOff + i];
                inno[innoOff + i] = 0;
            }

            /* Choose filter corresponding to codec mode and dispersion criterium */
            if (mode == Cnst.MR795) {
                ph_imp = impNr == 0 ? Tbls.ph_imp_low_MR795 : Tbls.ph_imp_mid_MR795;
            } else {
                ph_imp = impNr == 0 ? Tbls.ph_imp_low : Tbls.ph_imp_mid;
            }

            /* Do phase dispersion of innovation */
            for (nPulse = 0; nPulse < nze; nPulse++) {
                ppos = ps_poss[nPulse];

                /* circular convolution with impulse response */
                c_inno_sav = inno_sav[ppos];
                int pImp = 0;
                for (i = ppos; i < Cnst.L_SUBFR; i++) {
                    /* inno[i] += inno_sav[ppos] * ph_imp[i-ppos] */
                    L_temp = (c_inno_sav * ph_imp[pImp++]) >> 15;
                    tmp1 = (L_temp << 16) >> 16;
                    inno[innoOff + i] = (short) Basicop.add_16(inno[innoOff + i], tmp1, pOverflow);
                }
                for (i = 0; i < ppos; i++) {
                    /* inno[i] += inno_sav[ppos] * ph_imp[L_SUBFR-ppos+i] */
                    L_temp = (c_inno_sav * ph_imp[pImp++]) >> 15;
                    tmp1 = (L_temp << 16) >> 16;
                    inno[innoOff + i] = (short) Basicop.add_16(inno[innoOff + i], tmp1, pOverflow);
                }
            }
        }

        /* compute total excitation for synthesis part of decoder
           (using modified innovation if phase dispersion is active) */
        for (i = 0; i < Cnst.L_SUBFR; i++) {
            /* x[i] = gain_pit*x[i] + cbGain*code[i]; */
            L_temp = Basicop.L_mult(x[xOff + i], pitch_fac, pOverflow);
            L_temp2 = (inno[innoOff + i] * cbGain) << 1;
            L_temp = Basicop.L_add(L_temp, L_temp2, pOverflow);
            L_temp = Basicop.L_shl(L_temp, tmp_shift, pOverflow); /* Q16 */
            x[xOff + i] = (short) Basicop.pv_round(L_temp, pOverflow);
        }
    }
}
