package amr;
public final class AmrNbDecoder{
static final int[]a={
13,14,16,18,20,21,27,32,6,1,1,1,1,1,1,1}
;
static final byte[]b={
0x23,0x21,0x41,0x4d,0x52,0x0a}
;
private final c.d e=f.g();
public void reset(){
e.reset();
}
public void decode(byte[]h,short[]i,int j){
f.k(e,h,i,j);
}
public short[]decodeAll(byte[]l){
int m=0;
if(l.length>=6){
boolean n=true;
for(int o=0;
o<b.length;
o++){
if(l[o]!=b[o]){
n=false;
break;
}
}
if(n){
m=6;
}
}
int p=0;
int q=m;
while(q+1<=l.length){
int r=a[(l[q]>>3)&0x0f];
if(q+r>l.length){
break;
}
q+=r;
p++;
}
short[]out=new short[p*160];
byte[]h=new byte[32];
short[]i=new short[160];
int s=0;
while(m+1<=l.length){
int r=a[(l[m]>>3)&0x0f];
if(m+r>l.length){
break;
}
System.arraycopy(l,m,h,0,r);
f.k(e,h,i,0);
System.arraycopy(i,0,out,s,160);
s+=160;
m+=r;
}
return out;
}
}
final class t{
private t(){
}
public static final int u=320;
public static final int v=240;
public static final int w=160;
public static final int x=80;
public static final int y=40;
public static final int z=40;
public static final int A=5;
public static final int B=5;
public static final int C=4;
public static final int D=4;
public static final int E=10;
public static final int F=E+1;
public static final int G=205;
public static final int H=21299;
public static final int I=4*E+4;
public static final int J=18;
public static final int K=20;
public static final int L=143;
public static final int M=10+1;
public static final int N=4;
public static final int O=26214;
public static final int P=29491;
public static final int Q=40;
public static final int R=13017;
public static final int S=0;
public static final int T=57;
public static final int U=244;
public static final int V=15565;
public static final int W=7;
public static final int X=0x0008;
public static final int Y=0;
public static final int Z=1;
public static final int a1=2;
public static final int b1=3;
public static final int c1=4;
public static final int d1=5;
public static final int e1=6;
public static final int f1=7;
public static final int g1=8;
public static final int h1=9;
public static final int i1=0;
public static final int j1=1;
public static final int k1=2;
public static final int l1=3;
public static final int m1=4;
public static final int n1=5;
public static final int o1=6;
public static final int p1=7;
public static final int q1=8;
public static final int r1=9;
public static final int s1=10;
public static final int t1=11;
public static final int u1=12;
public static final int v1=13;
public static final int w1=14;
public static final int x1=15;
public static final int y1=0;
public static final int z1=1;
public static final int A1=2;
public static final int B1=3;
public static final int C1=4;
public static final int D1=5;
public static final int E1=6;
public static final int F1=7;
public static final int G1=8;
}
final class H1{
private H1(){
}
public static final int I1=0x7fffffff;
public static final int J1=-0x80000000;
public static final int K1=0x7fff;
public static final int L1=-0x8000;
static int M1(double N1){
if(N1!=N1||N1==0.0||N1==-0.0||O1.P1(N1)){
return 0;
}
double Q1=N1%4294967296.0;
if(Q1<0){
Q1+=4294967296.0;
}
return(int)Q1;
}
public static int R1(int S1,int T1,int[]U1){
int V1=S1+T1;
if((S1^T1)>=0){
if(((V1^S1)>>31)!=0){
V1=(S1>>31)!=0?J1:I1;
U1[0]=1;
}
}
return V1;
}
public static int W1(int S1,int T1,int[]U1){
int X1=S1-T1;
if(((S1^T1)>>31)!=0){
if((X1^S1)!=0&&((X1^S1)&J1)!=0){
X1=(S1>>31)!=0?J1:I1;
U1[0]=1;
}
}
return X1;
}
public static int Y1(int Z1,int a2,int b2,int[]U1){
int V1;
int c2=a2*b2;
if(c2!=0x40000000){
V1=(c2<<1)+Z1;
if((Z1^c2)>0){
if(((V1^Z1)>>31)!=0){
V1=(Z1>>31)!=0?J1:I1;
U1[0]=1;
}
}
}
else{
U1[0]=1;
V1=I1;
}
return V1;
}
public static int d2(int a2,int b2,int[]U1){
int e2=a2*b2;
if(e2!=0x40000000){
e2<<=1;
}
else{
U1[0]=1;
e2=I1;
}
return e2;
}
public static int f2(int Z1,int a2,int b2,int[]U1){
int c2=d2(a2,b2,U1);
c2=W1(Z1,c2,U1);
return c2;
}
public static int g2(int h2,int i2,int j2,int k2,int[]U1){
double l2=(double)h2*(double)j2;
int e2;
int V1;
int m2;
if(l2!=0x40000000){
e2=M1(l2)<<1;
}
else{
e2=I1;
}
m2=(h2*k2)>>15;
V1=e2+(m2<<1);
if((e2^m2)>0){
if(((V1^e2)>>31)!=0){
V1=(e2>>31)!=0?J1:I1;
}
}
e2=V1;
m2=(i2*j2)>>15;
V1=e2+(m2<<1);
if((e2^m2)>0){
if(((V1^e2)>>31)!=0){
V1=(e2>>31)!=0?J1:I1;
}
}
return V1;
}
public static int n2(int h2,int i2,int b2,int[]U1){
int e2=h2*b2;
int V1;
int c2;
if(e2!=0x40000000){
e2<<=1;
}
else{
U1[0]=1;
e2=I1;
}
c2=(i2*b2)>>15;
V1=e2+(c2<<1);
if((e2^c2)>0){
if(((V1^e2)>>31)!=0){
V1=(e2>>31)!=0?J1:I1;
U1[0]=1;
}
}
return V1;
}
public static int o2(int a2,int b2,int[]U1){
int p2=(a2*b2)>>15;
if(p2>0x00007fff){
U1[0]=1;
p2=K1;
}
return(p2<<16)>>16;
}
public static int q2(int S1,int T1,int Z1){
return Z1+S1*T1;
}
public static int r2(int S1,int T1,int Z1){
return Z1-S1*T1;
}
public static int s2(int Z1,int h2,int i2,int j2,int k2,int[]U1){
int p2;
Z1=Y1(Z1,h2,j2,U1);
p2=o2(h2,k2,U1);
Z1=Y1(Z1,p2,1,U1);
p2=o2(i2,j2,U1);
Z1=Y1(Z1,p2,1,U1);
return Z1;
}
public static int t2(int Z1,int h2,int i2,int b2,int[]U1){
int p2;
Z1=Y1(Z1,h2,b2,U1);
p2=o2(i2,b2,U1);
Z1=Y1(Z1,p2,1,U1);
return Z1;
}
public static int u2(int a2){
return a2==L1?K1:-a2;
}
public static int v2(int a2,int b2,int[]U1){
int w2=0;
if(b2<0){
b2=-b2;
if(b2<15){
w2=a2>>b2;
}
}
else{
w2=(a2<<b2<<16)>>16;
if(w2>>b2!=a2){
w2=(a2>>15)^K1;
}
}
return w2;
}
public static int x2(int S1,int b2,int[]U1){
int y2=0;
if(b2>0){
y2=S1<<b2;
if(y2>>b2!=S1){
y2=(S1>>31)^I1;
}
}
else{
b2=-b2;
if(b2<31){
y2=S1>>b2;
}
}
return y2;
}
public static int z2(int S1,int b2,int[]U1){
int y2=0;
if(b2>0){
if(b2<31){
y2=S1>>b2;
}
}
else{
b2=-b2;
y2=S1<<b2;
if(y2>>b2!=S1){
y2=(S1>>31)^I1;
}
}
return y2;
}
public static int A2(int a2){
int B2=((a2-(a2<0?1:0))<<16)>>16;
B2=B2^(B2>>15);
return B2;
}
public static int C2(int a2,int b2,int[]U1){
int D2=a2+b2;
if(D2>0x00007fff){
U1[0]=1;
D2=K1;
}
else if(D2<-32768){
U1[0]=1;
D2=L1;
}
return(D2<<16)>>16;
}
public static int E2(int a2,int b2,int[]U1){
int F2=a2-b2;
if(((long)(F2+32768)&0xffffffff G2)>0x0000ffff G2){
if(F2>0x00007fff){
F2=K1;
}
else{
F2=L1;
}
U1[0]=1;
}
return(F2<<16)>>16;
}
public static int H2(int a2,int b2,int[]U1){
int c2;
if(b2!=0){
if(b2>0){
if(b2>15){
b2=15;
}
c2=a2>>b2;
}
else{
b2=-b2;
if(b2>15){
b2=15;
}
c2=(a2<<b2<<16)>>16;
if(c2>>b2!=a2){
U1[0]=1;
c2=a2>0?K1:L1;
}
}
}
else{
c2=a2;
}
return c2;
}
public static int I2(int a2,int b2,int[]U1){
int J2=a2*b2;
J2+=0x00004000;
J2>>=15;
J2|=-(J2&0x00010000);
if(J2>0x00007fff){
U1[0]=1;
J2=K1;
}
else if(J2<-32768){
U1[0]=1;
J2=L1;
}
return(J2<<16)>>16;
}
public static int K2(int S1,int[]U1){
S1=R1(S1,0x00008000,U1);
return(S1>>16)<<16>>16;
}
public static int L2(int a2,int b2,int[]U1){
int w2;
if(b2>15){
w2=0;
}
else{
w2=H2(a2,b2,U1);
if(b2>0){
if((a2&(1<<(b2-1)))!=0){
w2++;
}
}
}
return w2;
}
public static int M2(int a2,int b2){
int w2=0;
int N2;
int O2;
int P2;
int Q2;
int R2;
if(a2>b2||a2<0){
return 0;
}
if(a2!=0){
if(a2!=b2){
O2=a2;
P2=b2;
Q2=P2<<1;
R2=P2<<2;
for(N2=5;
N2>0;
N2--){
w2<<=3;
O2<<=3;
if(O2>=R2){
O2-=R2;
w2|=4;
}
if(O2>=Q2){
O2-=Q2;
w2|=2;
}
if(O2>=P2){
O2-=P2;
w2|=1;
}
}
}
else{
w2=K1;
}
}
return w2;
}
public static int S2(int S1,int b2,int[]U1){
int c2;
if(b2>31){
c2=0;
}
else{
c2=z2(S1,b2,U1);
if(b2>0){
if((S1&(1<<(b2-1)))!=0){
c2++;
}
}
}
return c2;
}
public static int T2(int S1){
int w2=0;
if(S1!=0){
int B2=S1-(S1<0?1:0);
S1=B2^(B2>>31);
while((0x40000000&S1)==0){
w2++;
if((0x20000000&S1)!=0){
break;
}
w2++;
if((0x10000000&S1)!=0){
break;
}
w2++;
if((0x08000000&S1)!=0){
break;
}
w2++;
S1<<=4;
}
}
return w2;
}
public static int U2(int a2){
int w2=0;
if(a2!=0){
int B2=((a2-(a2<0?1:0))<<16)>>16;
a2=B2^(B2>>15);
while((0x4000&a2)==0){
w2++;
if((0x2000&a2)!=0){
break;
}
w2++;
if((0x1000&a2)!=0){
break;
}
w2++;
if((0x0800&a2)!=0){
break;
}
w2++;
a2<<=4;
}
}
return w2;
}
public static int V2(int S1){
return(S1>>16)<<16>>16;
}
public static int W2(int S1){
return(S1<<16)>>16;
}
public static int X2(int a2){
return a2<<16;
}
public static int Y2(int a2){
return a2;
}
}
final class Z2{
private Z2(){
}
private static final int a3=9;
private static final short[]b3=new short[a3];
private static final short[]c3=new short[a3];
public static int d3(short[]e3,int f3,int s){
int g3=0;
int h3;
final short[]i3=b3;
final short[]j3=c3;
for(int o=0;
o<s;
o++){
j3[o]=e3[f3+o];
}
for(int o=0;
o<s;
o++){
h3=-32767;
for(int k3=0;
k3<s;
k3++){
if(j3[k3]>=h3){
h3=j3[k3];
g3=k3;
}
}
j3[g3]=-32768;
i3[o]=(short)g3;
}
final int l3=i3[s>>1];
return e3[f3+l3];
}
public static int m3(int n3,int[]U1){
int o3;
int o;
int p3;
int i3;
int q3;
if(n3<=0){
return 0x3fffffff;
}
o3=H1.T2(n3);
n3<<=o3;
o3=30-o3;
if((o3&1)==0){
n3>>=1;
}
o3>>=1;
o3+=1;
n3>>=9;
o=(n3>>16)<<16>>16;
p3=(n3>>1)<<16>>16;
p3&=0x7fff;
o-=16;
q3=r3.s3[o]<<16;
i3=r3.s3[o]-r3.s3[o+1];
q3=q3-((i3*p3)<<1);
q3>>=o3;
return q3;
}
public static void t3(int n3,int o3,short[]u3,short[]v3){
int o;
int p3;
int i3;
int q3;
if(n3<=0){
u3[0]=0;
v3[0]=0;
}
else{
u3[0]=(short)(30-o3);
n3>>=10;
o=(n3>>15)<<16>>16;
p3=n3&0x7fff;
o-=32;
q3=r3.w3[o]<<16;
i3=r3.w3[o]-r3.w3[o+1];
q3=q3-((i3*p3)<<1);
v3[0]=(short)((q3>>16)<<16>>16);
}
}
public static void x3(int n3,short[]y3,short[]z3,int[]U1){
final int o3=H1.T2(n3);
t3(n3<<o3,o3,y3,z3);
}
public static int A3(int u3,int v3,int[]U1){
int o3;
int o;
int p3;
int i3;
int n3;
n3=H1.d2(v3,32,U1);
o=((n3>>16)<<16>>16)&31;
p3=((n3>>1)&0x7fff)<<16>>16;
n3=r3.B3[o]<<16;
i3=r3.B3[o]-r3.B3[o+1];
n3=H1.f2(n3,i3,p3,U1);
o3=30-u3;
n3=H1.S2(n3,o3,U1);
return n3;
}
public static int C3(int n3,short[]D3,int[]U1){
int E3;
int o;
int p3;
int i3;
int q3;
if(n3<=0){
D3[0]=0;
return 0;
}
E3=H1.T2(n3)&0xfffe;
n3=H1.x2(n3,E3,U1);
D3[0]=(short)E3;
n3>>=10;
o=((n3>>15)<<16>>16)&63;
p3=(n3<<16)>>16;
p3&=0x7fff;
if(o>15){
o-=16;
}
q3=r3.F3[o]<<16;
i3=r3.F3[o]-r3.F3[o+1];
q3=H1.f2(q3,i3,p3,U1);
return q3;
}
}
final class G3{
private G3(){
}
public static final int H3=6;
public static final int I3=10;
public static final short[]J3={
29443,28346,25207,20449,14701,8693,3143,-1352,-4402,-5865,-5850,-4673,-2783,-672,1211,2536,3130,2991,2259,1170,0,-1001,-1652,-1868,-1666,-1147,-464,218,756,1060,1099,904,550,135,-245,-514,-634,-602,-451,-231,0,191,308,340,296,198,78,-36,-120,-163,-165,-132,-79,-19,34,73,91,89,70,38,0,}
;
public static void K3(short[]p3,int L3,short[]M3,int N3,short[]O3,int P3){
O3[P3]=p3[L3];
for(int o=1;
o<=t.E;
o++){
O3[P3+o]=(short)(((p3[L3+o]*M3[N3+o-1]+0x00004000)>>15)<<16>>16);
}
}
public static void Q3(short[]R3,int S3,short[]T3,int U3,short[]V3,int W3,int X3){
int Y3,Z3,a4,b4;
int c4=W3+X3-1;
int d4=U3+X3-1-t.E;
for(int o=X3>>2;
o!=0;
o--){
Y3=0x0000800;
Z3=0x0000800;
a4=0x0000800;
b4=0x0000800;
int e4=S3+t.E;
int f4=d4--;
int g4=d4--;
int h4=d4--;
int i4=d4--;
for(int k3=t.E>>1;
k3!=0;
k3--){
Y3+=R3[e4]*T3[f4++];
Z3+=R3[e4]*T3[g4++];
a4+=R3[e4]*T3[h4++];
b4+=R3[e4--]*T3[i4++];
Y3+=R3[e4]*T3[f4++];
Z3+=R3[e4]*T3[g4++];
a4+=R3[e4]*T3[h4++];
b4+=R3[e4--]*T3[i4++];
}
Y3+=R3[e4]*T3[f4];
Z3+=R3[e4]*T3[g4];
a4+=R3[e4]*T3[h4];
b4+=R3[e4]*T3[i4];
V3[c4--]=(short)((Y3>>12)<<16>>16);
V3[c4--]=(short)((Z3>>12)<<16>>16);
V3[c4--]=(short)((a4>>12)<<16>>16);
V3[c4--]=(short)((b4>>12)<<16>>16);
}
}
private static final short[]j4=new short[2*t.E];
public static void k4(short[]p3,int L3,short[]l4,int m4,short[]B2,int n4,int o4,short[]p4,int q4,int r4){
int Y3,Z3;
int s4;
final short[]t4=j4;
for(int o=0;
o<t.E;
o++){
t4[o]=p4[q4+o];
}
int u4=t.E;
int v4=n4;
int w4=m4;
int x4=u4-1;
for(int o=t.E>>1;
o!=0;
o--){
int y4=L3;
Y3=H1.q2(l4[w4++],p3[y4],0x00000800);
Z3=H1.q2(l4[w4++],p3[y4++],0x00000800);
Y3=H1.r2(p3[y4++],t4[x4],Y3);
for(int k3=(t.E>>1)-2;
k3!=0;
k3--){
Z3=H1.r2(p3[y4],t4[x4--],Z3);
Y3=H1.r2(p3[y4++],t4[x4],Y3);
Z3=H1.r2(p3[y4],t4[x4--],Z3);
Y3=H1.r2(p3[y4++],t4[x4],Y3);
Z3=H1.r2(p3[y4],t4[x4--],Z3);
Y3=H1.r2(p3[y4++],t4[x4],Y3);
}
if(((long)(Y3+134217728)&0xffffffff G2)<0x0fffffff G2){
s4=((Y3>>12)<<16)>>16;
}
else if(Y3>0x07ffffff){
s4=H1.K1;
}
else{
s4=H1.L1;
}
Z3=H1.r2(p3[L3+1],s4,Z3);
t4[u4++]=(short)s4;
B2[v4++]=(short)s4;
x4=u4;
if(((long)(Z3+134217728)&0xffffffff G2)<0x0fffffff G2){
s4=((Z3>>12)<<16)>>16;
}
else if(Z3>0x07ffffff){
s4=H1.K1;
}
else{
s4=H1.L1;
}
t4[u4++]=(short)s4;
B2[v4++]=(short)s4;
}
int z4=n4+t.E-1;
for(int o=(o4-t.E)>>1;
o!=0;
o--){
int y4=L3;
Y3=H1.q2(l4[w4++],p3[y4],0x00000800);
Z3=H1.q2(l4[w4++],p3[y4++],0x00000800);
Y3=H1.r2(p3[y4++],B2[z4],Y3);
for(int k3=(t.E>>1)-2;
k3!=0;
k3--){
Z3=H1.r2(p3[y4],B2[z4--],Z3);
Y3=H1.r2(p3[y4++],B2[z4],Y3);
Z3=H1.r2(p3[y4],B2[z4--],Z3);
Y3=H1.r2(p3[y4++],B2[z4],Y3);
Z3=H1.r2(p3[y4],B2[z4--],Z3);
Y3=H1.r2(p3[y4++],B2[z4],Y3);
}
if(((long)(Y3+134217728)&0xffffffff G2)<0x0fffffff G2){
s4=((Y3>>12)<<16)>>16;
}
else if(Y3>0x07ffffff){
s4=H1.K1;
}
else{
s4=H1.L1;
}
Z3=H1.r2(p3[L3+1],s4,Z3);
B2[v4++]=(short)s4;
z4=v4;
if(((long)(Z3+134217728)&0xffffffff G2)<0x0fffffff G2){
B2[v4++]=(short)((Z3>>12)<<16>>16);
}
else if(Z3>0x07ffffff){
B2[v4++]=H1.K1;
}
else{
B2[v4++]=H1.L1;
}
}
if(r4!=0){
for(int o=0;
o<t.E;
o++){
p4[q4+o]=B2[n4+o4-t.E+o];
}
}
}
private static final short[]A4=new short[I3<<1];
public static void B4(short[]C4,int D4,int E4,int F4,int G4,int H4,int[]U1){
int Y3,Z3;
final short[]I4=A4;
int J4=D4-E4;
F4=-F4;
if(H4!=0){
F4<<=1;
}
if(F4<0){
F4+=H3;
J4--;
}
int K4=F4;
int L4=H3-F4;
int M4=0;
int N4=0;
for(int o=I3>>1;
o>0;
o--){
I4[M4++]=J3[K4+N4];
I4[M4++]=J3[L4+N4];
N4+=H3;
I4[M4++]=J3[K4+N4];
I4[M4++]=J3[L4+N4];
N4+=H3;
}
int O4=D4;
for(int k3=G4>>1;
k3!=0;
k3--){
J4++;
int P4=J4;
int Q4=J4++;
M4=0;
Y3=0x00004000;
Z3=0x00004000;
for(int o=I3>>1;
o>0;
o--){
Z3+=C4[Q4--]*I4[M4];
Y3+=C4[Q4]*I4[M4++];
Y3+=C4[P4++]*I4[M4];
Z3+=C4[P4]*I4[M4++];
Z3+=C4[Q4--]*I4[M4];
Y3+=C4[Q4]*I4[M4++];
Y3+=C4[P4++]*I4[M4];
Z3+=C4[P4]*I4[M4++];
}
C4[O4++]=(short)((Y3>>15)<<16>>16);
C4[O4++]=(short)((Z3>>15)<<16>>16);
}
}
}
final class R4{
private R4(){
}
public static final int S4=t.E/2;
public static final int T4=60;
private static final int[]U4=new int[6];
private static final int[]V4=new int[6];
private static void W4(short[]X4,int Y4,int[]Z4,int[]U1){
int a5;
int b5;
int c5;
int d5=0;
int e5=Y4;
Z4[d5++]=0x01000000;
Z4[d5++]=-X4[e5++]<<10;
e5++;
for(int o=2;
o<=5;
o++){
Z4[d5]=Z4[d5-2];
for(int k3=1;
k3<o;
k3++){
a5=(Z4[d5-1]>>16)<<16>>16;
b5=((Z4[d5-1]>>1)-(a5<<15))<<16>>16;
c5=a5*X4[e5];
c5+=(b5*X4[e5])>>15;
Z4[d5]=Z4[d5]+Z4[d5-2];
Z4[d5]=Z4[d5]-(c5<<2);
d5--;
}
Z4[d5]=Z4[d5]-(X4[e5++]<<10);
d5+=o;
e5++;
}
}
public static void f5(short[]X4,int Y4,short[]p3,int L3,int[]U1){
int c5;
int g5;
final int[]h5=U4;
final int[]i5=V4;
W4(X4,Y4,h5,U1);
W4(X4,Y4+1,i5,U1);
int j5=5;
int k5=5;
for(int o=5;
o>0;
o--){
h5[j5]=h5[j5]+h5[o-1];
j5--;
i5[k5]=i5[k5]-i5[o-1];
k5--;
}
int y4=L3;
p3[y4++]=4096;
int l5=1;
int m5=1;
for(int o=1,k3=10;
o<=5;
o++,k3--){
c5=h5[l5]+i5[m5];
g5=h5[l5++]-i5[m5++];
c5=c5+(1<<12);
g5=g5+(1<<12);
p3[y4++]=(short)((c5>>13)<<16>>16);
p3[L3+k3]=(short)((g5>>13)<<16>>16);
}
}
public static void n5(short[]o5,int p5,short[]X4,int Y4,int Q1,int[]U1){
for(int o=0;
o<Q1;
o++){
final int e3=o5[p5+o]>>8;
final int q5=o5[p5+o]&0x00ff;
final int r5=((r3.s5[e3+1]-r3.s5[e3])*q5)>>8;
X4[Y4+o]=(short)((r3.s5[e3]+((r5<<16)>>16))<<16>>16);
}
}
public static void t5(short[]X4,int Y4,short[]o5,int p5,int Q1,int[]U1){
int e3=63;
int u5=Y4+Q1-1;
int v5=p5+Q1-1;
for(int o=Q1-1;
o>=0;
o--){
final int s4=X4[u5--];
while(r3.s5[e3]<s4){
e3--;
}
int r5=(s4-r3.s5[e3])*r3.w5[e3];
r5=((r5+0x00000800))>>12;
o5[v5--]=(short)((((r5<<16)>>16)+(e3<<8))<<16>>16);
}
}
public static void x5(short[]o5,int p5,int y5,int s,int[]U1){
int z5=y5;
int q=p5;
for(int o=0;
o<s;
o++){
if(o5[q]<z5){
o5[q++]=(short)z5;
z5=(z5+y5)<<16>>16;
}
else{
z5=(o5[q++]+y5)<<16>>16;
}
}
}
private static int A5(int l4,short[]Z4,int s,int[]U1){
int B5;
int C5;
int D5;
int c5;
int E5;
int F5=1;
E5=0x01000000;
c5=(l4<<10)+(Z4[F5++]<<14);
C5=(c5>>16)<<16>>16;
D5=((c5>>1)-(C5<<15))<<16>>16;
for(int o=2;
o<s;
o++){
c5=C5*l4;
c5+=(D5*l4)>>15;
c5<<=2;
c5-=E5;
c5+=(Z4[F5++]<<14);
E5=(C5<<16)+(D5<<1);
C5=(c5>>16)<<16>>16;
D5=((c5>>1)-(C5<<15))<<16>>16;
}
c5=C5*l4;
c5+=(D5*l4)>>15;
c5<<=1;
c5-=E5;
c5+=(Z4[F5]<<13);
if(((long)(c5+33554432)&0xffffffff G2)<67108863 G2){
B5=(c5>>10)<<16>>16;
}
else if(c5>0x01ffffff){
B5=H1.K1;
}
else{
B5=H1.L1;
}
return B5;
}
private static final short[]G5=new short[S4+1];
private static final short[]H5=new short[S4+1];
public static void I5(short[]p3,int L3,short[]X4,int Y4,short[]J5,int K5,int[]U1){
int L5,M5,N5,O5,P5,Q5,R5;
int l4,B2,S5,o3;
final short[]h5=G5;
final short[]i5=H5;
h5[0]=1024;
i5[0]=1024;
for(int o=0;
o<S4;
o++){
final int T5=p3[L3+o+1];
final int U5=p3[L3+t.E-o];
l4=((T5+U5)>>2)<<16>>16;
B2=((T5-U5)>>2)<<16>>16;
h5[o+1]=(short)(l4-h5[o]);
i5[o+1]=(short)(B2+i5[o]);
}
int V5=0;
int W5=0;
short[]R3=h5;
L5=r3.X5[0];
M5=A5(L5,R3,S4,U1);
int k3=0;
while(V5<t.E&&k3<T4){
k3++;
N5=L5;
O5=M5;
L5=r3.X5[k3];
M5=A5(L5,R3,S4,U1);
if(M5*O5<=0){
for(int o=4;
o!=0;
o--){
l4=L5>>1;
B2=N5>>1;
P5=(l4+B2)<<16>>16;
Q5=A5(P5,R3,S4,U1);
if(M5*Q5<=0){
O5=Q5;
N5=P5;
}
else{
M5=Q5;
L5=P5;
}
}
l4=(N5-L5)<<16>>16;
B2=(O5-M5)<<16>>16;
if(B2==0){
R5=L5;
}
else{
S5=B2;
B2=H1.A2(B2);
o3=H1.U2(B2);
B2=(B2<<o3)<<16>>16;
B2=H1.M2(16383,B2);
B2=((l4*B2)>>(19-o3))<<16>>16;
if(S5<0){
B2=(-B2)<<16>>16;
}
R5=(L5-((M5*B2)>>10))<<16>>16;
}
X4[Y4+V5]=(short)R5;
L5=R5;
V5++;
if(W5==0){
W5=1;
R3=i5;
}
else{
W5=0;
R3=h5;
}
M5=A5(L5,R3,S4,U1);
}
}
if(V5<t.E){
for(int o=0;
o<t.E;
o++){
X4[Y4+o]=J5[K5+o];
}
}
}
}
final class Y5{
private Y5(){
}
private static final short[]Z5=new short[t.E];
public static void a6(short[]b6,int c6,short[]d6,int e6,short[]f6,int g6,short[]h6,int i6,int[]U1){
final short[]X4=Z5;
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((b6[c6+o]>>1)+(d6[e6+o]>>1));
}
R4.f5(X4,0,h6,i6,U1);
R4.f5(d6,e6,h6,i6+t.F,U1);
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((d6[e6+o]>>1)+(f6[g6+o]>>1));
}
R4.f5(X4,0,h6,i6+2*t.F,U1);
R4.f5(f6,g6,h6,i6+3*t.F,U1);
}
public static void j6(short[]b6,int c6,short[]d6,int e6,short[]f6,int g6,short[]h6,int i6,int[]U1){
final short[]X4=Z5;
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((b6[c6+o]>>1)+(d6[e6+o]>>1));
}
R4.f5(X4,0,h6,i6,U1);
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((d6[e6+o]>>1)+(f6[g6+o]>>1));
}
R4.f5(X4,0,h6,i6+2*t.F,U1);
}
public static void k6(short[]b6,int c6,short[]f6,int g6,short[]h6,int i6,int[]U1){
final short[]X4=Z5;
int s4;
for(int o=0;
o<t.E;
o++){
s4=(b6[c6+o]-(b6[c6+o]>>2))<<16>>16;
X4[o]=(short)(s4+(f6[g6+o]>>2));
}
R4.f5(X4,0,h6,i6,U1);
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((f6[g6+o]>>1)+(b6[c6+o]>>1));
}
R4.f5(X4,0,h6,i6+t.F,U1);
for(int o=0;
o<t.E;
o++){
s4=(f6[g6+o]-(f6[g6+o]>>2))<<16>>16;
X4[o]=(short)(s4+(b6[c6+o]>>2));
}
R4.f5(X4,0,h6,i6+2*t.F,U1);
R4.f5(f6,g6,h6,i6+3*t.F,U1);
}
public static void l6(short[]b6,int c6,short[]f6,int g6,short[]h6,int i6,int[]U1){
final short[]X4=Z5;
int s4;
for(int o=0;
o<t.E;
o++){
s4=(b6[c6+o]-(b6[c6+o]>>2))<<16>>16;
X4[o]=(short)(s4+(f6[g6+o]>>2));
}
R4.f5(X4,0,h6,i6,U1);
for(int o=0;
o<t.E;
o++){
X4[o]=(short)((f6[g6+o]>>1)+(b6[c6+o]>>1));
}
R4.f5(X4,0,h6,i6+t.F,U1);
for(int o=0;
o<t.E;
o++){
s4=(f6[g6+o]-(f6[g6+o]>>2))<<16>>16;
X4[o]=(short)(s4+(b6[c6+o]>>2));
}
R4.f5(X4,0,h6,i6+2*t.F,U1);
}
public static void m6(short[]o5,int p5,short[]n6,int o6,int[]U1){
int s4;
int p6;
int q6=o6;
int v5=p5;
int r6=p5+1;
n6[q6++]=o5[r6++];
for(int o=4;
o!=0;
o--){
n6[q6++]=(short)(o5[r6++]-o5[v5++]);
n6[q6++]=(short)(o5[r6++]-o5[v5++]);
}
n6[q6]=(short)(16384-o5[v5]);
q6=o6;
for(int o=10;
o!=0;
o--){
p6=n6[q6];
s4=(p6-1843)<<16>>16;
if(s4>0){
s4=(s4*6242)>>15<<16>>16;
p6=(1843-s4)<<16>>16;
}
else{
s4=(p6*28160)>>15<<16>>16;
p6=(3427-s4)<<16>>16;
}
n6[q6++]=(short)(p6<<3);
}
}
}
final class s6{
private s6(){
}
public static final int t6=4;
public static final int u6=783741;
public static final int v6=-14336;
public static final int w6=-2381;
public static final short[]x6={
5571,4751,2785,1556}
;
public static final short[]y6={
44,37,22,12}
;
public static final class d{
public short[]z6;
public short[]A6;
public d(){
this.z6=new short[t6];
this.A6=new short[t6];
reset();
}
public int reset(){
for(int o=0;
o<t6;
o++){
z6[o]=(short)v6;
A6[o]=(short)w6;
}
return 0;
}
}
private static final short[]B6=new short[1];
private static final short[]C6=new short[1];
public static void D6(d E6,int F6,short[]G6,int H6,short[]I6,short[]J6,short[]K6,short[]L6,int[]U1){
int T5,U5;
int r5;
int M6;
int N6;
int O6,P6;
int i3;
int Q6=H6;
M6=0;
for(int o=t.y>>2;
o!=0;
o--){
i3=G6[Q6++];
M6+=(i3*i3)>>3;
i3=G6[Q6++];
M6+=(i3*i3)>>3;
i3=G6[Q6++];
M6+=(i3*i3)>>3;
i3=G6[Q6++];
M6+=(i3*i3)>>3;
}
M6<<=4;
if((M6>>31)!=0){
M6=H1.I1;
}
if(F6==t.f1){
M6=(H1.K2(M6,U1)*26214)<<1;
Z2.x3(M6,B6,C6,U1);
final int o3=B6[0];
final int F4=C6[0];
T5=(o3-30)<<16;
M6=T5+(F4<<1);
N6=u6;
for(int o=0;
o<t6;
o++){
T5=(E6.A6[o]*y6[o])<<1;
N6=H1.R1(N6,T5,U1);
}
T5=H1.W1(N6,M6,U1);
I6[0]=(short)((T5>>17)<<16>>16);
U5=I6[0]<<15;
T5>>=2;
J6[0]=(short)(((T5-U5)<<16)>>16);
}
else{
O6=H1.T2(M6);
M6=H1.x2(M6,O6,U1);
Z2.t3(M6,O6,B6,C6);
final int o3=B6[0];
final int F4=C6[0];
U5=(o3*-24660)<<1;
r5=(F4*-24660)>>15;
if((r5&0x00010000)!=0){
r5=r5|0xffff0000;
}
r5<<=1;
r5=H1.R1(r5,U5,U1);
if(F6==t.e1){
U5=16678<<7;
r5=H1.R1(r5,U5,U1);
}
else if(F6==t.d1){
L6[0]=(short)((M6>>16)<<16>>16);
K6[0]=(short)(-11-O6);
U5=17062<<7;
r5=H1.R1(r5,U5,U1);
}
else if(F6==t.c1){
U5=32588<<6;
r5=H1.R1(r5,U5,U1);
}
else if(F6==t.b1){
U5=32268<<6;
r5=H1.R1(r5,U5,U1);
}
else{
U5=16678<<7;
r5=H1.R1(r5,U5,U1);
}
if(r5>0x001fffff){
U1[0]=1;
r5=H1.I1;
}
else if(r5<-2097152){
U1[0]=1;
r5=H1.J1;
}
else{
r5<<=10;
}
for(int o=0;
o<4;
o++){
U5=(x6[o]*E6.z6[o])<<1;
r5=H1.R1(r5,U5,U1);
}
P6=(r5>>16)<<16>>16;
if(F6==t.c1){
r5=(P6*5439)<<1;
}
else{
r5=(P6*5443)<<1;
}
if(r5<0){
r5=~((~r5)>>8);
}
else{
r5>>=8;
}
I6[0]=(short)((r5>>16)<<16>>16);
if(r5<0){
T5=~((~r5)>>1);
}
else{
T5=r5>>1;
}
U5=I6[0]<<15;
J6[0]=(short)((H1.W1(T5,U5,U1)<<16)>>16);
}
}
public static void R6(d E6,int S6,int T6){
E6.z6[3]=E6.z6[2];
E6.A6[3]=E6.A6[2];
E6.z6[2]=E6.z6[1];
E6.A6[2]=E6.A6[1];
E6.z6[1]=E6.z6[0];
E6.A6[1]=E6.A6[0];
E6.A6[0]=(short)S6;
E6.z6[0]=(short)T6;
}
public static void U6(d E6,short[]V6,short[]W6,int[]U1){
int X6;
X6=0;
for(int o=0;
o<t6;
o++){
X6=H1.C2(X6,E6.A6[o],U1);
}
if(X6<0){
X6=((X6>>2)|0xc000)<<16>>16;
}
else{
X6>>=2;
}
if(X6<w6){
X6=w6;
}
V6[0]=(short)X6;
X6=0;
for(int o=0;
o<t6;
o++){
X6=H1.C2(X6,E6.z6[o],U1);
}
if(X6<0){
X6=((X6>>2)|0xc000)<<16>>16;
}
else{
X6>>=2;
}
if(X6<v6){
X6=v6;
}
W6[0]=(short)X6;
}
}
final class Y6{
private Y6(){
}
public static final class d{
public int Z6;
public d(){
reset();
}
public int reset(){
this.Z6=4096;
return 0;
}
}
private static int a7(short[]T3,int b7,int c7,int[]U1){
int d7=0;
int s4;
for(int o=0;
o<c7;
o++){
s4=T3[b7+o]>>2;
d7=H1.Y1(d7,s4,s4,U1);
}
return d7;
}
private static int e7(short[]T3,int b7,int c7,int[]U1){
int d7=0;
final int f7=U1[0];
for(int o=0;
o<c7;
o++){
d7=H1.Y1(d7,T3[b7+o],T3[b7+o],U1);
}
if(d7!=H1.I1){
d7=d7>>4;
}
else{
U1[0]=f7;
d7=a7(T3,b7,c7,U1);
}
return d7;
}
public static void g7(d E6,short[]h7,int i7,short[]j7,int k7,int l7,int c7,int[]U1){
int o;
int o3;
int m7;
int n7;
int o7;
int p7;
int d7;
int E5;
int s4;
d7=e7(j7,k7,c7,U1);
if(d7==0){
E6.Z6=0;
return;
}
o3=(H1.T2(d7)-1)<<16>>16;
E5=H1.x2(d7,o3,U1);
n7=H1.K2(E5,U1);
d7=e7(h7,i7,c7,U1);
if(d7==0){
o7=0;
}
else{
o=H1.T2(d7);
E5=d7<<o;
m7=H1.K2(E5,U1);
o3=(o3-o)<<16>>16;
s4=H1.M2(n7,m7);
d7=s4;
d7=d7<<7;
d7=H1.z2(d7,o3,U1);
d7=Z2.m3(d7,U1);
E5=d7<<9;
o=((E5+0x00008000)>>16)<<16>>16;
s4=(32767-l7)<<16>>16;
o7=((o*s4)>>15)<<16>>16;
}
p7=E6.Z6;
int q7=k7;
for(o=0;
o<c7;
o++){
p7=((p7*l7)>>15)<<16>>16;
p7=(p7+o7)<<16>>16;
E5=(j7[q7]*p7)<<1;
j7[q7++]=(short)((E5>>13)<<16>>16);
}
E6.Z6=p7;
}
public static void r7(short[]h7,int i7,short[]j7,int k7,int c7,int[]U1){
int o;
int o3;
int m7;
int n7;
int o7;
int d7;
int E5;
int s4;
d7=e7(j7,k7,c7,U1);
if(d7==0){
return;
}
o3=(H1.T2(d7)-1)<<16>>16;
E5=H1.x2(d7,o3,U1);
n7=H1.K2(E5,U1);
d7=e7(h7,i7,c7,U1);
if(d7==0){
o7=0;
}
else{
o=H1.T2(d7);
E5=H1.x2(d7,o,U1);
m7=H1.K2(E5,U1);
o3=(o3-o)<<16>>16;
s4=H1.M2(n7,m7);
d7=s4;
if(d7>0x00ffffff){
d7=H1.I1;
}
else if(d7<-16777216){
d7=H1.J1;
}
else{
d7=d7<<7;
}
d7=H1.z2(d7,o3,U1);
d7=Z2.m3(d7,U1);
if(d7>0x003fffff){
E5=H1.I1;
}
else if(d7<-4194304){
E5=H1.J1;
}
else{
E5=d7<<9;
}
o7=H1.K2(E5,U1);
}
for(o=c7-1;
o>=0;
o--){
E5=H1.d2(j7[k7+o],o7,U1);
if(E5>0x0fffffff){
j7[k7+o]=H1.K1;
}
else if(E5<-268435456){
j7[k7+o]=H1.L1;
}
else{
j7[k7+o]=(short)((E5>>13)<<16>>16);
}
}
}
}
final class s7{
private s7(){
}
public static final int t7=60;
public static final int u7=17578;
public static final int v7=20;
public static final int w7=1953;
public static final class d{
public short[]x7;
public int y7;
public d(){
this.x7=new short[t7];
this.y7=0;
reset();
}
public int reset(){
for(int o=0;
o<t7;
o++){
x7[o]=0;
}
this.y7=0;
return 0;
}
}
public static int z7(d E6,short[]A7,int B7,short[]C7,int D7,short[]E7,int[]U1){
int F7,G7;
int s4;
int H7,I7;
int J7,K7,L7,M7;
int d7,E5;
d7=0;
for(int o=t.w-1;
o>=0;
o--){
E5=C7[D7+o]*C7[D7+o];
if(E5!=0x40000000){
E5=E5<<1;
}
else{
E5=H1.I1;
}
d7=H1.R1(d7,E5,U1);
}
if(d7>0x1fffffff){
J7=H1.K1;
}
else{
J7=(d7>>14)<<16>>16;
}
I7=32767;
for(int o=t7-1;
o>=0;
o--){
if(E6.x7[o]<I7){
I7=E6.x7[o];
}
}
E5=I7<<4;
if(E5!=((E5<<16)>>16)){
if(E5>0){
K7=H1.K1;
}
else{
K7=H1.L1;
}
}
else{
K7=(E5<<16)>>16;
}
L7=E6.x7[0];
for(int o=t7-5;
o>=1;
o--){
if(L7<E6.x7[o]){
L7=E6.x7[o];
}
}
M7=E6.x7[(2*t7/3)];
for(int o=(2*t7/3)+1;
o<t7;
o++){
if(M7<E6.x7[o]){
M7=E6.x7[o];
}
}
if(L7>v7&&J7<u7&&J7>v7&&(J7<K7||M7<w7)){
if(E6.y7+1>30){
E6.y7=30;
}
else{
E6.y7+=1;
}
}
else{
E6.y7=0;
}
G7=E6.y7>1?1:0;
for(int o=0;
o<t7-1;
o++){
E6.x7[o]=E6.x7[o+1];
}
E6.x7[t7-1]=(short)J7;
if(E6.y7>15){
H7=16383;
}
else if(E6.y7>8){
H7=15565;
}
else{
H7=13926;
}
F7=0;
if(Z2.d3(A7,B7+4,5)>H7){
F7=1;
}
if(E6.y7>20){
if(Z2.d3(A7,B7,9)>H7){
F7=1;
}
else{
F7=0;
}
}
if(F7!=0){
E7[0]=0;
}
else{
s4=E7[0]+1;
if(s4>10){
E7[0]=10;
}
else{
E7[0]=(short)s4;
}
}
return G7;
}
}
final class N7{
private N7(){
}
public static final int O7=7;
public static final class d{
public short[]P7;
public int Q7;
public int R7;
public d(){
this.P7=new short[O7];
reset();
}
public int reset(){
for(int o=0;
o<O7;
o++){
P7[o]=0;
}
this.Q7=0;
this.R7=0;
return 0;
}
}
private static final short[]S7=new short[t.E];
public static int T7(d E6,int F6,int U7,short[]X4,int Y4,short[]V7,int W7,int j,int X7,int Y7,int Z7,int a8,int E7,int[]U1){
int b8;
int F2;
int c8;
int d8;
int e8;
int V1;
final short[]i3=S7;
int f8;
int j3;
int g8;
int h8;
int i8;
b8=U7;
for(int o=0;
o<O7-1;
o++){
E6.P7[o]=E6.P7[o+1];
}
E6.P7[O7-1]=(short)U7;
F2=0;
for(int o=0;
o<t.E;
o++){
f8=H1.A2(H1.E2(V7[W7+o],X4[Y4+o],U1));
g8=(H1.U2(f8)-1)<<16>>16;
f8=H1.v2(f8,g8,U1);
h8=H1.U2(V7[W7+o]);
j3=H1.v2(V7[W7+o],h8,U1);
i3[o]=(short)H1.M2(f8,j3);
i8=(2+g8-h8)<<16>>16;
if(i8>=0){
i3[o]=(short)H1.H2(i3[o],i8,U1);
}
else{
i3[o]=(short)H1.v2(i3[o],H1.u2(i8),U1);
}
F2=H1.C2(F2,i3[o],U1);
}
if(F2>5325){
E6.Q7+=1;
}
else{
E6.Q7=0;
}
if(E6.Q7>10){
E6.R7=0;
}
d8=8192;
if(F6<=t.b1||F6==t.e1){
if(((Y7!=0&&Z7!=0)||j!=0||X7!=0)&&E7>1&&a8!=0&&(F6==t.Y||F6==t.Z||F6==t.a1)){
c8=(F2-4506)<<16>>16;
}
else{
c8=(F2-3277)<<16>>16;
}
f8=c8>0?c8:0;
if(f8>2048){
d8=8192;
}
else{
d8=H1.v2(f8,2,U1);
}
if(E6.R7<40||F2>5325){
d8=8192;
}
V1=H1.d2(6554,E6.P7[2],U1);
for(int o=3;
o<O7;
o++){
V1=H1.Y1(V1,6554,E6.P7[o],U1);
}
e8=H1.K2(V1,U1);
if((j!=0||X7!=0)&&a8!=0&&(F6==t.Y||F6==t.Z||F6==t.a1)){
V1=H1.d2(4681,E6.P7[0],U1);
for(int o=1;
o<O7;
o++){
V1=H1.Y1(V1,4681,E6.P7[o],U1);
}
e8=H1.K2(V1,U1);
}
V1=H1.d2(d8,b8,U1);
V1=H1.Y1(V1,8192,e8,U1);
V1=H1.f2(V1,d8,e8,U1);
b8=H1.K2(H1.x2(V1,2,U1),U1);
}
E6.R7+=1;
return b8;
}
}
final class j8{
private j8(){
}
public static final class k8{
public short[]l8;
public int m8;
public int n8;
public k8(){
this.l8=new short[5];
reset();
}
public int reset(){
for(int o=0;
o<5;
o++){
l8[o]=1640;
}
this.m8=0;
this.n8=16384;
return 0;
}
}
public static final class o8{
public short[]p8;
public int q8;
public int r8;
public o8(){
this.p8=new short[5];
reset();
}
public int reset(){
for(int o=0;
o<5;
o++){
p8[o]=1;
}
this.q8=0;
this.r8=1;
return 0;
}
}
public static final short[]s8={
32767,32112,32112,32112,32112,32112,22937}
;
public static final short[]t8={
32767,32112,32112,26214,9830,6553,6553}
;
private static final short[]u8=new short[1];
private static final short[]v8=new short[1];
public static void w8(o8 E6,s6.d x8,int e,short[]U7,int[]U1){
int i3=Z2.d3(E6.p8,0,5);
if(H1.E2(i3,E6.q8,U1)>0){
i3=E6.q8;
}
i3=H1.o2(i3,s8[e],U1);
U7[0]=(short)i3;
s6.U6(x8,u8,v8,U1);
s6.R6(x8,u8[0],v8[0]);
}
public static void y8(o8 E6,int j,int X7,short[]U7,int[]U1){
if(j==0){
if(X7!=0){
if(H1.E2(U7[0],E6.r8,U1)>0){
U7[0]=(short)E6.r8;
}
}
E6.r8=U7[0];
}
E6.q8=U7[0];
for(int o=1;
o<5;
o++){
E6.p8[o-1]=E6.p8[o];
}
E6.p8[4]=U7[0];
}
public static void z8(k8 E6,int e,short[]A8,int[]U1){
int i3=Z2.d3(E6.l8,0,5);
if(H1.E2(i3,E6.m8,U1)>0){
i3=E6.m8;
}
A8[0]=(short)H1.o2(i3,t8[e],U1);
}
public static void B8(k8 E6,int j,int X7,short[]A8,int[]U1){
if(j==0){
if(X7!=0){
if(H1.E2(A8[0],E6.n8,U1)>0){
A8[0]=(short)E6.n8;
}
}
E6.n8=A8[0];
}
E6.m8=A8[0];
if(H1.E2(E6.m8,16384,U1)>0){
E6.m8=16384;
}
for(int o=1;
o<5;
o++){
E6.l8[o-1]=E6.l8[o];
}
E6.l8[4]=(short)E6.m8;
}
public static final int C8=5243;
public static final class D8{
public short[]E8;
public D8(){
this.E8=new short[t.E];
reset();
}
public int reset(){
System.arraycopy(r3.F8,0,E8,0,t.E);
return 0;
}
}
public static void G8(D8 E6,short[]X4,int Y4,int[]U1){
int r5;
for(int o=0;
o<t.E;
o++){
r5=E6.E8[o]<<16;
r5=H1.f2(r5,C8,E6.E8[o],U1);
r5=H1.Y1(r5,C8,X4[Y4+o],U1);
E6.E8[o]=(short)H1.K2(r5,U1);
}
}
}
final class H8{
private H8(){
}
public static final int I8=29491;
public static final int J8=3277;
public static final int K8=31128;
public static final int L8=1639;
public static final int M8=256;
public static final int N8=512;
public static final int O8=512;
public static final int P8=128;
public static final int Q8=512;
public static final class d{
public short[]R8;
public short[]S8;
public d(){
this.R8=new short[t.E];
this.S8=new short[t.E];
reset();
}
public int reset(){
for(int o=0;
o<t.E;
o++){
R8[o]=0;
}
System.arraycopy(r3.F8,0,S8,0,t.E);
return 0;
}
}
public static void T8(d E6,int U8){
System.arraycopy(r3.V8,U8*t.E,E6.R8,0,t.E);
}
private static final short[]W8=new short[t.E];
private static final short[]X8=new short[t.E];
public static void Y8(d E6,int F6,int j,short[]Z8,int a9,short[]b9,int c9,int[]U1){
int s4;
int U8;
final short[]d9=W8;
final short[]e9=X8;
if(j!=0){
for(int o=0;
o<t.E;
o++){
s4=H1.o2(E6.S8[o],I8,U1);
U8=H1.o2(r3.f9[o],J8,U1);
e9[o]=(short)H1.C2(U8,s4,U1);
}
if(F6!=t.g1){
for(int o=0;
o<t.E;
o++){
s4=H1.o2(E6.R8[o],r3.g9[o],U1);
s4=H1.C2(r3.f9[o],s4,U1);
E6.R8[o]=(short)H1.E2(e9[o],s4,U1);
}
}
else{
for(int o=0;
o<t.E;
o++){
s4=H1.C2(r3.f9[o],E6.R8[o],U1);
E6.R8[o]=(short)H1.E2(e9[o],s4,U1);
}
}
}
else{
int h9=0;
final int i9=(N8-1)*3;
int j9=0;
short[]k9;
short[]l9;
final short[]m9=r3.n9;
if(F6==t.Y||F6==t.Z){
k9=r3.o9;
l9=r3.p9;
h9=(M8-1)*3;
j9=(P8-1)*4;
}
else if(F6==t.d1){
k9=r3.q9;
l9=r3.r9;
h9=(Q8-1)*3;
j9=(O8-1)*4;
}
else{
k9=r3.o9;
l9=r3.r9;
h9=(M8-1)*3;
j9=(O8-1)*4;
}
int s9=a9;
U8=Z8[s9++];
s4=U8+(U8<<1);
if(s4>h9){
s4=h9;
}
d9[0]=k9[s4];
d9[1]=k9[s4+1];
d9[2]=k9[s4+2];
U8=Z8[s9++];
if(F6==t.Y||F6==t.Z){
U8<<=1;
}
s4=U8+(U8<<1);
if(s4>i9){
s4=i9;
}
d9[3]=m9[s4];
d9[4]=m9[s4+1];
d9[5]=m9[s4+2];
U8=Z8[s9++];
s4=U8<<2;
if(s4>j9){
s4=j9;
}
d9[6]=l9[s4];
d9[7]=l9[s4+1];
d9[8]=l9[s4+2];
d9[9]=l9[s4+3];
if(F6!=t.g1){
for(int o=0;
o<t.E;
o++){
s4=H1.o2(E6.R8[o],r3.g9[o],U1);
s4=H1.C2(r3.f9[o],s4,U1);
e9[o]=(short)H1.C2(d9[o],s4,U1);
E6.R8[o]=d9[o];
}
}
else{
for(int o=0;
o<t.E;
o++){
s4=H1.C2(r3.f9[o],E6.R8[o],U1);
e9[o]=(short)H1.C2(d9[o],s4,U1);
E6.R8[o]=d9[o];
}
}
}
R4.x5(e9,0,t.G,t.E,U1);
System.arraycopy(e9,0,E6.S8,0,t.E);
R4.n5(e9,0,b9,c9,t.E,U1);
}
private static final short[]t9=new short[t.E];
private static final short[]u9=new short[t.E];
private static final short[]v9=new short[t.E];
private static final short[]w9=new short[t.E];
public static void x9(d E6,int j,short[]Z8,int a9,short[]b9,int c9,short[]y9,int z9,int[]U1){
int s4;
int S5;
int o;
final short[]d9=t9;
final short[]A9=u9;
final short[]e9=v9;
final short[]B9=w9;
if(j!=0){
for(o=0;
o<t.E;
o++){
s4=((E6.S8[o]*K8)>>15)<<16>>16;
S5=((r3.F8[o]*L8)>>15)<<16>>16;
e9[o]=(short)H1.C2(S5,s4,U1);
B9[o]=e9[o];
s4=((E6.R8[o]*t.H)>>15)<<16>>16;
s4=H1.C2(r3.F8[o],s4,U1);
E6.R8[o]=(short)H1.E2(B9[o],s4,U1);
}
}
else{
s4=H1.v2(Z8[a9],2,U1);
d9[0]=r3.C9[s4];
d9[1]=r3.C9[s4+1];
A9[0]=r3.C9[s4+2];
A9[1]=r3.C9[s4+3];
s4=H1.v2(Z8[a9+1],2,U1);
d9[2]=r3.D9[s4];
d9[3]=r3.D9[s4+1];
A9[2]=r3.D9[s4+2];
A9[3]=r3.D9[s4+3];
S5=Z8[a9+2]&1;
if(Z8[a9+2]<0){
o=~(~Z8[a9+2]>>1);
}
else{
o=Z8[a9+2]>>1;
}
s4=H1.v2(o,2,U1);
if(S5==0){
d9[4]=r3.E9[s4];
d9[5]=r3.E9[s4+1];
A9[4]=r3.E9[s4+2];
A9[5]=r3.E9[s4+3];
}
else{
d9[4]=(short)H1.u2(r3.E9[s4]);
d9[5]=(short)H1.u2(r3.E9[s4+1]);
A9[4]=(short)H1.u2(r3.E9[s4+2]);
A9[5]=(short)H1.u2(r3.E9[s4+3]);
}
s4=H1.v2(Z8[a9+3],2,U1);
d9[6]=r3.F9[s4];
d9[7]=r3.F9[s4+1];
A9[6]=r3.F9[s4+2];
A9[7]=r3.F9[s4+3];
s4=H1.v2(Z8[a9+4],2,U1);
d9[8]=r3.G9[s4];
d9[9]=r3.G9[s4+1];
A9[8]=r3.G9[s4+2];
A9[9]=r3.G9[s4+3];
for(o=0;
o<t.E;
o++){
s4=H1.o2(E6.R8[o],t.H,U1);
s4=H1.C2(r3.F8[o],s4,U1);
e9[o]=(short)H1.C2(d9[o],s4,U1);
B9[o]=(short)H1.C2(A9[o],s4,U1);
E6.R8[o]=A9[o];
}
}
R4.x5(e9,0,t.G,t.E,U1);
R4.x5(B9,0,t.G,t.E,U1);
System.arraycopy(B9,0,E6.S8,0,t.E);
R4.n5(e9,0,b9,c9,t.E,U1);
R4.n5(B9,0,y9,z9,t.E,U1);
}
public static void H9(short[]I9,int J9,short[]K9,int L9,int M9,short[]N9,int O9,int[]U1){
int P9;
int Q9;
if(M9==0){
for(int o=t.E-1;
o>=0;
o--){
if(I9[J9+o]<0){
P9=~(~I9[J9+o]>>2);
}
else{
P9=I9[J9+o]>>2;
}
if(K9[L9+o]<0){
Q9=~(~K9[L9+o]>>2);
}
else{
Q9=K9[L9+o]>>2;
}
N9[O9+o]=(short)H1.C2((I9[J9+o]-P9)<<16>>16,Q9<<16>>16,U1);
}
}
else if(M9==40){
for(int o=t.E-1;
o>=0;
o--){
if(I9[J9+o]<0){
P9=~(~I9[J9+o]>>1);
}
else{
P9=I9[J9+o]>>1;
}
if(K9[L9+o]<0){
Q9=~(~K9[L9+o]>>1);
}
else{
Q9=K9[L9+o]>>1;
}
N9[O9+o]=(short)(P9+Q9);
}
}
else if(M9==80){
for(int o=t.E-1;
o>=0;
o--){
if(I9[J9+o]<0){
P9=~(~I9[J9+o]>>2);
}
else{
P9=I9[J9+o]>>2;
}
if(K9[L9+o]<0){
Q9=~(~K9[L9+o]>>2);
}
else{
Q9=K9[L9+o]>>2;
}
N9[O9+o]=(short)H1.C2(P9<<16>>16,(K9[L9+o]-Q9)<<16>>16,U1);
}
}
else if(M9==120){
for(int o=t.E-1;
o>=0;
o--){
N9[O9+o]=K9[L9+o];
}
}
}
}
final class R9{
private R9(){
}
public static final int S9=8191;
public static final int T9=8191;
public static void U9(int V9,int S5,int U8,short[]W9,int X9,int[]U1){
final short[]Y9=new short[2];
int o,k3,N4;
k3=(U8&64)<<16>>16;
k3>>=3;
o=U8&7;
N4=H1.v2(V9,1,U1);
N4=(N4+k3)<<16>>16;
Y9[0]=(short)(o*5+r3.Z9[N4++]);
U8>>=3;
o=U8&7;
Y9[1]=(short)(o*5+r3.Z9[N4]);
for(o=t.y-1;
o>=0;
o--){
W9[X9+o]=0;
}
for(k3=0;
k3<2;
k3++){
o=S5&0x1;
W9[X9+Y9[k3]]=(short)(o*16383-8192);
S5>>=1;
}
}
public static void a10(int S5,int U8,short[]W9,int X9){
final short[]Y9=new short[2];
int o,k3;
k3=U8&0x1;
U8>>=1;
o=U8&0x7;
Y9[0]=(short)(o*5+k3*2+1);
U8>>=3;
k3=U8&0x3;
U8>>=2;
o=U8&0x7;
if(k3==3){
Y9[1]=(short)(o*5+4);
}
else{
Y9[1]=(short)(o*5+k3);
}
for(o=0;
o<t.y;
o++){
W9[X9+o]=0;
}
for(k3=0;
k3<2;
k3++){
o=S5&1;
W9[X9+Y9[k3]]=(short)(o*16383-8192);
S5>>=1;
}
}
public static void b10(int S5,int U8,short[]W9,int X9){
final short[]Y9=new short[3];
int o,k3;
o=U8&0x7;
Y9[0]=(short)(o*5);
U8>>=3;
k3=U8&0x1;
U8>>=1;
o=U8&0x7;
Y9[1]=(short)(o*5+k3*2+1);
U8>>=3;
k3=U8&0x1;
U8>>=1;
o=U8&0x7;
Y9[2]=(short)(o*5+k3*2+2);
for(o=0;
o<t.y;
o++){
W9[X9+o]=0;
}
for(k3=0;
k3<3;
k3++){
o=S5&1;
W9[X9+Y9[k3]]=(short)(o*16383-8192);
S5>>=1;
}
}
public static void c10(int S5,int U8,short[]W9,int X9){
final short[]Y9=new short[4];
int o,k3;
o=U8&0x7;
o=r3.d10[o];
Y9[0]=(short)(o*5);
U8>>=3;
o=U8&0x7;
o=r3.d10[o];
Y9[1]=(short)(o*5+1);
U8>>=3;
o=U8&0x7;
o=r3.d10[o];
Y9[2]=(short)(o*5+2);
U8>>=3;
k3=U8&0x1;
U8>>=1;
o=U8&0x7;
o=r3.d10[o];
Y9[3]=(short)(o*5+3+k3);
for(o=0;
o<t.y;
o++){
W9[X9+o]=0;
}
for(k3=0;
k3<4;
k3++){
o=S5&0x1;
W9[X9+Y9[k3]]=(short)(o*16383-8192);
S5>>=1;
}
}
private static void e10(int f10,int g10,int h10,int i10,int j10,short[]k10,int[]U1){
int l10,m10,n10;
int o10;
if(f10>124){
f10=124;
}
l10=H1.o2(f10,1311,U1);
o10=H1.d2(l10,25,U1);
l10=((f10-(o10>>1))<<16)>>16;
m10=H1.o2(l10,6554,U1);
o10=H1.d2(m10,5,U1);
m10=(l10-(((o10>>1)<<16)>>16))<<16>>16;
m10=H1.v2(m10,1,U1);
n10=(g10-((g10>>2)<<2))<<16>>16;
k10[h10]=(short)((m10+(n10&1))<<16>>16);
m10=H1.o2(l10,6554,U1);
m10=H1.v2(m10,1,U1);
k10[i10]=(short)((m10+(n10>>1))<<16>>16);
m10=g10>>2;
n10=H1.o2(f10,1311,U1);
n10=H1.v2(n10,1,U1);
k10[j10]=(short)H1.C2(m10,n10,U1);
}
private static final short[]p10=new short[t.C];
private static final short[]q10=new short[8];
private static void r10(short[]s10,int t10,short[]u10,short[]k10,int[]U1){
int l10,m10;
int f10,g10,v10;
int o10;
for(int o=0;
o<t.C;
o++){
u10[o]=s10[t10+o];
}
f10=s10[t10+t.C]>>3;
g10=s10[t10+t.C]&0x7;
e10(f10,g10,0,4,1,k10,U1);
f10=s10[t10+t.C+1]>>3;
g10=s10[t10+t.C+1]&0x7;
e10(f10,g10,2,6,5,k10,U1);
f10=s10[t10+t.C+2]>>2;
g10=s10[t10+t.C+2]&0x3;
o10=H1.d2(f10,25,U1);
l10=(H1.z2(o10,1,U1)<<16)>>16;
l10=(l10+12)<<16>>16;
v10=l10>>5;
l10=H1.o2(v10,6554,U1);
l10&=1;
m10=H1.o2(v10,6554,U1);
o10=H1.d2(m10,5,U1);
m10=(v10-(((o10>>1)<<16)>>16))<<16>>16;
if(l10==1){
m10=(4-m10)<<16>>16;
}
m10=H1.v2(m10,1,U1);
l10=g10&0x1;
k10[3]=(short)H1.C2(m10,l10,U1);
l10=H1.o2(v10,6554,U1);
l10=H1.v2(l10,1,U1);
k10[7]=(short)((l10+(g10>>1))<<16>>16);
}
public static void w10(short[]U8,int x10,short[]W9,int X9,int[]U1){
int y10,z10,S5;
final short[]A10=p10;
final short[]B10=q10;
for(int o=0;
o<t.z;
o++){
W9[X9+o]=0;
}
r10(U8,x10,A10,B10,U1);
for(int k3=0;
k3<t.C;
k3++){
y10=((B10[k3]<<2)+k3)<<16>>16;
if(A10[k3]==0){
S5=S9;
}
else{
S5=-T9;
}
if(y10<t.y){
W9[X9+y10]=(short)S5;
}
z10=((B10[k3+4]<<2)+k3)<<16>>16;
if(z10<y10){
S5=H1.u2(S5);
}
if(z10<t.y){
W9[X9+z10]=(short)((W9[X9+z10]+S5)<<16>>16);
}
}
}
public static void C10(short[]U8,int x10,short[]W9,int X9){
int y10,z10,S5,i3,o;
for(o=0;
o<t.z;
o++){
W9[X9+o]=0;
}
for(int k3=0;
k3<t.A;
k3++){
i3=U8[x10+k3];
o=i3&7;
o=r3.d10[o];
o=(o*5)<<16>>16;
y10=(o+k3)<<16>>16;
o=(i3>>3)&1;
S5=o==0?4096:-4096;
W9[X9+y10]=(short)S5;
o=U8[x10+k3+5]&7;
o=r3.d10[o];
o=(o*5)<<16>>16;
z10=(o+k3)<<16>>16;
if(z10<y10){
S5=H1.u2(S5);
}
W9[X9+z10]=(short)((W9[X9+z10]+S5)<<16>>16);
}
}
}
final class D10{
private D10(){
}
public static final int E10=256;
public static int F10(int F6,int U8){
int p7=r3.G10[U8];
if(F6==t.f1){
p7=(p7&0xfffc)<<16>>16;
}
return p7;
}
private static final short[]H10=new short[1];
private static final short[]I10=new short[1];
private static final short[]J10=new short[1];
private static final short[]K10=new short[1];
public static void L10(s6.d x8,int F6,int U8,short[]G6,int H6,short[]U7,int[]U1){
int P6;
int r5;
s6.D6(x8,F6,G6,H6,H10,I10,J10,K10,U1);
final int o3=H10[0];
final int F4=I10[0];
U8&=31;
final int M10=U8+(U8<<1);
int q=M10;
final int s4=H1.E2(F6,t.f1,U1);
if(s4==0){
P6=(Z2.A3(o3,F4,U1)<<16)>>16;
P6=H1.v2(P6,4,U1);
U7[0]=(short)H1.v2(H1.o2(P6,r3.N10[q++],U1),1,U1);
}
else{
P6=(Z2.A3(14,F4,U1)<<16)>>16;
r5=H1.d2(r3.N10[q++],P6,U1);
r5=H1.z2(r5,H1.E2(9,o3,U1),U1);
U7[0]=(short)((r5>>16)<<16>>16);
}
final int S6=r3.N10[q++];
final int T6=r3.N10[q++];
s6.R6(x8,S6,T6);
}
public static void O10(s6.d x8,int F6,int U8,short[]G6,int H6,int P10,short[]Q10,short[]R10,int[]U1){
int q;
short[]S10;
int T10;
int T6;
int S6;
int r5;
int P9;
int Q9;
U8=H1.v2(U8,2,U1);
if(F6==t.e1||F6==t.c1||F6==t.b1){
S10=r3.U10;
q=U8;
Q10[0]=S10[q++];
T10=S10[q++];
S6=S10[q++];
T6=S10[q];
}
else if(F6==t.Y){
U8+=(1^P10)<<1;
if(U8>E10*4-2){
U8=E10*4-2;
}
S10=r3.V10;
q=U8;
Q10[0]=S10[q++];
T10=S10[q++];
P9=T10;
Z2.x3(P9,H10,I10,U1);
final int W10=(H10[0]-12)<<16>>16;
P9=H1.L2(I10[0],5,U1);
Q9=H1.v2(W10,10,U1);
S6=H1.C2(P9,Q9,U1);
r5=H1.n2(W10,I10[0],24660,U1);
r5=H1.x2(r5,13,U1);
T6=H1.K2(r5,U1);
}
else{
S10=r3.X10;
q=U8;
Q10[0]=S10[q++];
T10=S10[q++];
S6=S10[q++];
T6=S10[q];
}
s6.D6(x8,F6,G6,H6,H10,I10,null,null,U1);
final int P6=(Z2.A3(14,I10[0],U1)<<16)>>16;
r5=H1.d2(T10,P6,U1);
P9=(10-H10[0])<<16>>16;
r5=H1.z2(r5,P9,U1);
R10[0]=(short)((r5>>16)<<16>>16);
s6.R6(x8,S6,T6);
}
public static void Y10(int U8,int Z10,int a11,int M9,int b11,short[]E4,short[]c11,int d11,int[]U1){
int o;
int e11;
if(M9==0){
if(U8<197){
e11=(U8+2)<<16>>16;
e11=H1.o2(e11,10923,U1);
o=(e11+19)<<16>>16;
E4[0]=(short)o;
o=(o<<1)<<16>>16;
o=(o+E4[0])<<16>>16;
e11=(U8-o)<<16>>16;
c11[0]=(short)((e11+58)<<16>>16);
}
else{
E4[0]=(short)((U8-112)<<16>>16);
c11[0]=0;
}
}
else{
if(d11==0){
o=(U8+2)<<16>>16;
o=(o*10923>>15)<<16>>16;
o=(o-1)<<16>>16;
E4[0]=(short)((o+Z10)<<16>>16);
o=(o+((o<<1)<<16>>16))<<16>>16;
e11=(U8-2)<<16>>16;
c11[0]=(short)((e11-o)<<16>>16);
}
else{
e11=b11;
o=H1.E2(e11,Z10,U1);
if(o>5){
e11=(Z10+5)<<16>>16;
}
o=(a11-e11)<<16>>16;
if(o>4){
e11=(a11-4)<<16>>16;
}
if(U8<4){
o=(e11-5)<<16>>16;
E4[0]=(short)((o+U8)<<16>>16);
c11[0]=0;
}
else if(U8<12){
o=(U8-5)<<16>>16;
o=(o*10923>>15)<<16>>16;
o=(o-1)<<16>>16;
E4[0]=(short)((o+e11)<<16>>16);
o=(o+((o<<1)<<16>>16))<<16>>16;
e11=(U8-9)<<16>>16;
c11[0]=(short)((e11-o)<<16>>16);
}
else{
o=(U8-12)<<16>>16;
o=(o+e11)<<16>>16;
E4[0]=(short)((o+1)<<16>>16);
c11[0]=0;
}
}
}
}
public static void f11(int U8,int g11,int h11,int M9,short[]E4,short[]c11,int[]U1){
int o;
int i11;
int j11;
int N4;
if(M9==0){
if(U8<463){
o=(U8+5)<<16>>16;
o=(o*5462>>15)<<16>>16;
o=(o+17)<<16>>16;
E4[0]=(short)o;
o=(o<<1)<<16>>16;
o=(o+E4[0])<<16>>16;
o=(o<<1)<<16>>16;
o=(U8-o)<<16>>16;
c11[0]=(short)((o+105)<<16>>16);
}
else{
E4[0]=(short)((U8-368)<<16>>16);
c11[0]=0;
}
}
else{
i11=(E4[0]-5)<<16>>16;
if(i11<g11){
i11=g11;
}
j11=(i11+9)<<16>>16;
if(j11>h11){
j11=h11;
i11=(j11-9)<<16>>16;
}
o=(U8+5)<<16>>16;
o=(o*5462>>15)<<16>>16;
o=(o-1)<<16>>16;
E4[0]=(short)((o+i11)<<16>>16);
o=(o+((o<<1)<<16>>16))<<16>>16;
o=(o<<1)<<16>>16;
N4=(U8-3)<<16>>16;
c11[0]=(short)((N4-o)<<16>>16);
}
}
}
final class k11{
private k11(){
}
public static final int l11=5;
public static final int m11=9830;
public static final int n11=14746;
public static final int o11=16384;
public static final int p11=2;
public static final class d{
public short[]q11;
public int r11;
public int s11;
public int t11;
public int u11;
public d(){
this.q11=new short[l11];
reset();
}
public int reset(){
for(int o=0;
o<l11;
o++){
q11[o]=0;
}
this.r11=0;
this.s11=0;
this.t11=0;
this.u11=0;
return 0;
}
}
public static void v11(d e){
e.t11=1;
}
public static void w11(d e){
e.t11=0;
}
private static final short[]x11=new short[t.y];
private static final short[]y11=new short[t.y];
public static void z11(d e,int F6,short[]l4,int m4,int A11,int B11,short[]C11,int D11,int E11,int F11,int[]U1){
int o,G11;
int f8;
int E5;
int U5;
int H11;
final short[]I11=x11;
final short[]J11=y11;
int K11,L11;
int M11;
short[]N11;
int O11;
e.q11[4]=e.q11[3];
e.q11[3]=e.q11[2];
e.q11[2]=e.q11[1];
e.q11[1]=e.q11[0];
e.q11[0]=(short)B11;
if(B11<n11){
if(B11>m11){
H11=1;
}
else{
H11=0;
}
}
else{
H11=2;
}
E5=(e.s11*o11)<<1;
if(E5>0x1fffffff){
U1[0]=1;
E5=H1.I1;
}
else if(E5<-536870912){
U1[0]=1;
E5=H1.J1;
}
else{
E5<<=2;
}
f8=H1.K2(E5,U1);
if(A11>f8){
e.u11=p11;
}
else if(e.u11>0){
e.u11-=1;
}
if(e.u11==0){
G11=0;
for(o=0;
o<l11;
o++){
if(e.q11[o]<m11){
G11+=1;
}
}
if(G11>2){
H11=0;
}
}
if(H11>e.r11+1&&e.u11==0){
H11-=1;
}
if(H11<2&&e.u11>0){
H11+=1;
}
if(A11<10){
H11=2;
}
if(e.t11==1){
H11=0;
}
e.r11=H11;
e.s11=A11;
if(F6!=t.f1&&F6!=t.e1&&F6!=t.c1&&H11<2){
K11=0;
for(o=0;
o<t.y;
o++){
if(C11[D11+o]!=0){
J11[K11]=(short)o;
K11+=1;
}
I11[o]=C11[D11+o];
C11[D11+o]=0;
}
if(F6==t.d1){
N11=H11==0?r3.P11:r3.Q11;
}
else{
N11=H11==0?r3.R11:r3.S11;
}
for(L11=0;
L11<K11;
L11++){
M11=J11[L11];
O11=I11[M11];
int T11=0;
for(o=M11;
o<t.y;
o++){
E5=(O11*N11[T11++])>>15;
f8=(E5<<16)>>16;
C11[D11+o]=(short)H1.C2(C11[D11+o],f8,U1);
}
for(o=0;
o<M11;
o++){
E5=(O11*N11[T11++])>>15;
f8=(E5<<16)>>16;
C11[D11+o]=(short)H1.C2(C11[D11+o],f8,U1);
}
}
}
for(o=0;
o<t.y;
o++){
E5=H1.d2(l4[m4+o],E11,U1);
U5=(C11[D11+o]*A11)<<1;
E5=H1.R1(E5,U5,U1);
E5=H1.x2(E5,F11,U1);
l4[m4+o]=(short)H1.K2(E5,U1);
}
}
}
final class U11{
private U11(){
}
public static final class V11{
public int W11;
public V11(){
reset();
}
public int reset(){
this.W11=0;
return 0;
}
}
public static void X11(V11 E6,short[]Y11,int Z11,int a12,int G2,int[]U1){
int Q9;
int f4=Z11+G2-1;
int g4=f4-1;
final int s4=Y11[f4];
for(int o=0;
o<=G2-2;
o++){
Q9=H1.o2(a12,Y11[g4--],U1);
Y11[f4]=(short)H1.E2(Y11[f4],Q9,U1);
f4--;
}
Q9=H1.o2(a12,E6.W11,U1);
Y11[f4]=(short)H1.E2(Y11[f4],Q9,U1);
E6.W11=s4;
}
public static final short[]b12={
7699,-15398,7699}
;
public static final short[]c12={
8192,15836,-7667}
;
public static final class d12{
public int e12;
public int f12;
public int g12;
public int h12;
public int i12;
public int j12;
public d12(){
reset();
}
public int reset(){
this.e12=0;
this.f12=0;
this.g12=0;
this.h12=0;
this.i12=0;
this.j12=0;
return 0;
}
}
public static void k12(d12 E6,short[]Y11,int Z11,int o4,int[]U1){
int l12;
int r5;
final int m12=c12[1];
final int n12=c12[2];
final int o12=b12[0];
final int p12=b12[1];
final int q12=b12[2];
int q=Z11;
for(int o=0;
o<o4;
o++){
l12=E6.j12;
E6.j12=E6.i12;
E6.i12=Y11[q];
r5=E6.g12*m12;
r5+=(E6.h12*m12)>>15;
r5+=E6.e12*n12;
r5+=(E6.f12*n12)>>15;
r5+=E6.i12*o12;
r5+=E6.j12*p12;
r5+=l12*q12;
r5=H1.x2(r5,3,U1);
Y11[q++]=(short)H1.K2(H1.x2(r5,1,U1),U1);
E6.e12=E6.g12;
E6.f12=E6.h12;
E6.g12=(r5>>16)<<16>>16;
E6.h12=((r5>>1)-(E6.g12<<15))<<16>>16;
}
}
private static final short[]r12=new short[t.E];
private static final short[]s12=new short[t.E];
public static void t12(short[]p3,int L3,short[]u12,int v12,int[]U1){
final short[]w12=r12;
final short[]x12=s12;
int y12;
int z12;
int A12;
int B12;
int E5;
int s4;
int C12;
for(int o=0;
o<t.E;
o++){
w12[o]=p3[L3+o];
}
for(int o=t.E-1;
o>=0;
o--){
if(H1.A2(w12[o])>=4096){
for(int k3=0;
k3<t.E;
k3++){
u12[v12+k3]=0;
}
break;
}
u12[v12+o]=(short)H1.v2(w12[o],3,U1);
E5=H1.d2(u12[v12+o],u12[v12+o],U1);
A12=H1.W1(H1.I1,E5,U1);
y12=H1.T2(A12);
B12=(15-y12)<<16>>16;
A12=H1.x2(A12,y12,U1);
z12=H1.K2(A12,U1);
C12=H1.M2(16384,z12);
boolean D12=false;
for(int k3=0;
k3<o;
k3++){
A12=w12[k3]<<16;
A12=H1.f2(A12,u12[v12+o],w12[o-k3-1],U1);
s4=H1.K2(A12,U1);
E5=H1.d2(C12,s4,U1);
E5=H1.S2(E5,B12,U1);
int E12=E5-(E5<0?1:0);
E12=E12^(E12>>31);
if(E12>32767){
for(int N4=0;
N4<t.E;
N4++){
u12[v12+N4]=0;
}
D12=true;
break;
}
x12[k3]=(short)((E5<<16)>>16);
}
if(D12){
break;
}
for(int k3=0;
k3<o;
k3++){
w12[k3]=x12[k3];
}
}
}
public static final int F12=10;
public static int G12(int[]H12,int I12){
int J12=0;
int K12;
int s4;
for(int o=0;
o<I12;
o++){
if((H12[0]&0x00000001)!=0){
K12=1;
}
else{
K12=0;
}
if((H12[0]&0x10000000)!=0){
K12^=1;
}
else{
K12^=0;
}
J12=(J12<<1)<<16>>16;
s4=(H12[0]&1)<<16>>16;
J12=(J12|s4)<<16>>16;
H12[0]>>=1;
if((K12&1)!=0){
H12[0]|=0x40000000;
}
}
return J12;
}
public static void L12(int[]M12,short[]W9,int X9,int[]U1){
int o,k3,s4;
for(o=0;
o<t.y;
o++){
W9[X9+o]=0;
}
for(int N4=0;
N4<F12;
N4++){
o=G12(M12,2);
s4=(H1.d2(o,10,U1)<<16)>>16;
o=s4>>1;
o=H1.C2(o,N4,U1);
k3=G12(M12,1);
if(k3>0){
W9[X9+o]=4096;
}
else{
W9[X9+o]=-4096;
}
}
}
public static void N12(short[]M12,int O12,short[]P12,short[]Q12,int R12,int[]U1){
int E5;
int s4;
E5=H1.d2(M12[0],31821,U1);
E5>>=1;
M12[0]=(short)((H1.R1(E5,13849,U1)<<16)>>16);
int S12=M12[0]&0x7f;
for(int o=0;
o<O12;
o++){
s4=(~(0xffff<<P12[o]))<<16>>16;
Q12[R12+o]=(short)(r3.T12[S12++]&s4);
}
}
}
final class U12{
private U12(){
}
public static final int V12=22;
public static final short[]W12={
22938,16057,11240,7868,5508,3856,2699,1889,1322,925,}
;
public static final short[]X12={
18022,9912,5451,2998,1649,907,499,274,151,83,}
;
public static final short[]Y12={
24576,18432,13824,10368,7776,5832,4374,3281,2461,1846,}
;
public static final short[]Z12={
22938,16057,11240,7868,5508,3856,2699,1889,1322,925,}
;
public static final class d{
public short[]a13;
public short[]b13;
public U11.V11 c13;
public Y6.d d13;
public short[]e13;
public d(){
this.a13=new short[t.y];
this.b13=new short[t.E];
this.c13=new U11.V11();
this.d13=new Y6.d();
this.e13=new short[t.E+t.w];
reset();
}
public int reset(){
for(int o=0;
o<t.E;
o++){
b13[o]=0;
}
for(int o=0;
o<t.y;
o++){
a13[o]=0;
}
for(int o=0;
o<t.E+t.w;
o++){
e13[o]=0;
}
this.d13.reset();
this.c13.reset();
return 0;
}
}
private static final short[]f13=new short[t.F];
private static final short[]g13=new short[t.F];
private static final short[]h13=new short[V12];
public static void i13(d E6,int F6,short[]j13,int k13,short[]l13,int m13,int[]U1){
final short[]n13=f13;
final short[]o13=g13;
final short[]p13=h13;
int P9;
int Q9;
int r5;
int q13;
final short[]r13=E6.e13;
final int s13=t.E;
for(int o=0;
o<t.w;
o++){
r13[s13+o]=j13[k13+o];
}
int h6=m13;
for(int M9=0;
M9<t.w;
M9+=t.y){
if(F6==t.f1||F6==t.e1){
G3.K3(l13,h6,W12,0,n13,0);
G3.K3(l13,h6,Y12,0,o13,0);
}
else{
G3.K3(l13,h6,X12,0,n13,0);
G3.K3(l13,h6,Z12,0,o13,0);
}
G3.Q3(n13,0,r13,s13+M9,E6.a13,0,t.y);
for(int o=0;
o<=t.E;
o++){
p13[o]=n13[o];
}
for(int o=t.E+1;
o<V12;
o++){
p13[o]=0;
}
G3.k4(o13,0,p13,0,p13,0,V12,p13,t.E+1,0);
r5=0;
for(int o=V12-1;
o>=0;
o--){
q13=p13[o]*p13[o];
if(q13!=0x40000000){
q13=q13<<1;
}
else{
U1[0]=1;
break;
}
r5=H1.R1(r5,q13,U1);
}
P9=(r5>>16)<<16>>16;
r5=0;
for(int o=V12-2;
o>=0;
o--){
q13=p13[o]*p13[o+1];
if(q13!=0x40000000){
q13=q13<<1;
}
else{
U1[0]=1;
break;
}
r5=H1.R1(r5,q13,U1);
}
Q9=(r5>>16)<<16>>16;
if(Q9<=0){
Q9=0;
}
else{
r5=(Q9*t.O)>>15;
if((r5&0x00010000)!=0){
r5=r5|0xffff0000;
}
Q9=(r5<<16)>>16;
Q9=H1.M2(Q9,P9);
}
U11.X11(E6.c13,E6.a13,0,Q9,t.y,U1);
G3.k4(o13,0,E6.a13,0,j13,k13+M9,t.y,E6.b13,0,1);
Y6.g7(E6.d13,r13,s13+M9,j13,k13+M9,t.P,t.y,U1);
h6+=t.F;
}
for(int o=0;
o<t.E;
o++){
E6.e13[o]=E6.e13[t.w+o];
}
}
public static int t13(short[]u13,int v13,int w13,short[]x13,int y13,int E7,int z13,int A13,int[]U1){
int o3;
int B13,C13,D13,E13;
int c5;
D13=Z2.d3(x13,y13,9);
E13=(x13[y13+7]+x13[y13+8])>>1;
if(x13[y13+8]<E13){
E13=x13[y13+8];
}
if(w13<D13&&w13>5){
B13=H1.v2(E13,2,U1);
if(E7<7||z13!=0){
B13=H1.E2(B13,E13,U1);
}
if(D13>B13){
D13=B13;
}
o3=H1.U2(w13);
w13=H1.v2(w13,o3,U1);
w13=H1.M2(16383,w13);
c5=H1.d2(D13,w13,U1);
c5=H1.z2(c5,H1.E2(20,o3,U1),U1);
if(c5>32767){
c5=32767;
}
C13=(c5<<16)>>16;
if(A13!=0&&C13>3072){
C13=3072;
}
for(int o=0;
o<t.y;
o++){
c5=H1.d2(C13,u13[v13+o],U1);
c5=H1.z2(c5,11,U1);
u13[v13+o]=(short)((c5<<16)>>16);
}
}
return 0;
}
}
final class F13{
private F13(){
}
public static final int G13=0;
public static final int H13=1;
public static final int I13=2;
public static final int J13=50;
public static final int K13=8;
public static final int L13=24+7-1;
public static final int M13=7;
public static final int N13=0x70816958;
public static final short[]O13={
20000,20000,20000,20000,20000,18000,16384,8192,0,0,}
;
public static final short[]P13={
-1023,-878,-732,-586,-440,-294,-148,0,0,}
;
public static final class d{
public int Q13;
public int R13;
public int S13;
public int T13;
public int[]U13;
public short[]X4;
public short[]b6;
public short[]V13;
public int W13;
public short[]X13;
public int Y13;
public short[]Z13;
public int a14;
public int b14;
public int c14;
public int d14;
public int e14;
public int f14;
public int g14;
public int h14;
public int i14;
public d(){
this.U13=new int[1];
this.X4=new short[t.E];
this.b6=new short[t.E];
this.V13=new short[t.E*K13];
this.X13=new short[t.E*K13];
this.Z13=new short[K13];
this.h14=H13;
reset();
}
public int reset(){
this.Q13=0;
this.R13=1<<13;
this.S13=3500;
this.T13=3500;
this.U13[0]=N13;
final short[]j14={
30000,26000,21000,15000,8000,0,-8000,-15000,-21000,-26000}
;
System.arraycopy(j14,0,this.X4,0,t.E);
System.arraycopy(j14,0,this.b6,0,t.E);
this.W13=0;
this.Y13=0;
this.a14=0;
final short[]k14={
1384,2077,3420,5108,6742,8122,9863,11092,12714,13701}
;
System.arraycopy(k14,0,this.V13,0,t.E);
for(int o=1;
o<K13;
o++){
System.arraycopy(this.V13,0,this.V13,t.E*o,t.E);
}
for(int o=0;
o<t.E*K13;
o++){
this.X13[o]=0;
}
for(int o=0;
o<K13;
o++){
this.Z13[o]=(short)this.S13;
}
this.b14=0;
this.c14=M13;
this.d14=32767;
this.e14=0;
this.f14=0;
this.g14=0;
this.h14=H13;
this.i14=0;
return 0;
}
}
private static final short[]l14=new short[t.E];
private static final short[]m14=new short[t.E+1];
private static final short[]n14=new short[t.E];
private static final short[]o14=new short[t.y];
private static final short[]p14=new short[t.E];
private static final short[]q14=new short[t.E];
private static final short[]r14=new short[t.E];
private static final short[]s14=new short[t.E+1];
private static final short[]t14=new short[t.E];
private static final int[]u14=new int[t.E];
private static final short[]v14=new short[1];
private static final short[]w14=new short[1];
public static void x14(d E6,short[]y14,int z14,H8.d A14,s6.d B14,N7.d C14,int D14,int F6,short[]Q12,int R12,short[]E14,int F14,short[]G14,int H14,int[]U1){
int I14;
int o,k3;
int J14;
int K14;
final short[]L14=l14;
int M14;
int N14;
int O14;
final short[]P14=m14;
final short[]u12=n14;
int Q14;
final short[]R14=o14;
int S14;
int T14;
int U14;
int V14;
int W14;
int X14;
int Y14;
final short[]Z14=p14;
final short[]a15=q14;
final short[]b15=r14;
final short[]c15=s14;
final short[]o5=t14;
final int[]d15=u14;
int e15;
int f15;
int E5;
int s4;
if(E6.g14!=0&&E6.e14!=0){
E6.b14=P13[F6];
e15=E6.W13+t.E;
if(e15==80){
e15=0;
}
System.arraycopy(E6.V13,E6.W13,E6.V13,e15,t.E);
e15=E6.a14+1;
if(e15==K13){
e15=0;
}
E6.Z13[e15]=E6.Z13[E6.a14];
E6.S13=0;
for(o=t.E-1;
o>=0;
o--){
d15[o]=0;
}
for(o=K13-1;
o>=0;
o--){
if(E6.Z13[o]<0){
s4=~(~E6.Z13[o]>>3);
}
else{
s4=E6.Z13[o]>>3;
}
E6.S13=H1.C2(E6.S13,s4,U1);
for(k3=t.E-1;
k3>=0;
k3--){
d15[k3]=H1.R1(d15[k3],E6.V13[o*t.E+k3],U1);
}
}
for(k3=t.E-1;
k3>=0;
k3--){
if(d15[k3]<0){
o5[k3]=(short)((~(~d15[k3]>>3)<<16)>>16);
}
else{
o5[k3]=(short)((d15[k3]>>3)<<16>>16);
}
}
R4.n5(o5,0,E6.X4,0,t.E,U1);
E6.S13=H1.E2(E6.S13,E6.b14,U1);
System.arraycopy(E6.V13,0,E6.X13,0,80);
for(o=t.E-1;
o>=0;
o--){
W14=0;
for(k3=8-1;
k3>=0;
k3--){
W14=H1.R1(W14,E6.X13[o+k3*t.E],U1);
}
if(W14<0){
V14=(~(~W14>>3)<<16)>>16;
}
else{
V14=(W14>>3)<<16>>16;
}
for(k3=8-1;
k3>=0;
k3--){
E6.X13[o+k3*t.E]=(short)H1.E2(E6.X13[o+k3*t.E],V14,U1);
E6.X13[o+k3*t.E]=(short)H1.o2(E6.X13[o+k3*t.E],O13[o],U1);
if(E6.X13[o+k3*t.E]<0){
U14=1;
}
else{
U14=0;
}
E6.X13[o+k3*t.E]=(short)H1.A2(E6.X13[o+k3*t.E]);
if(E6.X13[o+k3*t.E]>655){
E6.X13[o+k3*t.E]=(short)(655+((E6.X13[o+k3*t.E]-655)>>2));
}
if(E6.X13[o+k3*t.E]>1310){
E6.X13[o+k3*t.E]=1310;
}
if(U14!=0){
E6.X13[o+k3*t.E]=(short)-E6.X13[o+k3*t.E];
}
}
}
}
if(E6.e14!=0){
System.arraycopy(E6.X4,0,E6.b6,0,t.E);
E6.T13=E6.S13;
if(E6.f14!=0){
f15=E6.Q13;
E6.Q13=0;
if(f15>=32){
f15=32;
}
E5=f15<<10;
if(E5!=((E5<<16)>>16)){
U1[0]=1;
E5=f15>0?H1.K1:H1.L1;
}
s4=(E5<<16)>>16;
if(f15>=2){
E6.R13=H1.M2(1<<10,s4);
}
else{
E6.R13=1<<14;
}
H8.T8(A14,Q12[R12]);
H8.Y8(A14,t.g1,0,Q12,R12+1,E6.X4,0,U1);
for(o=0;
o<t.E;
o++){
A14.R8[o]=0;
}
I14=Q12[R12+4];
if(I14>63||I14<-64){
E6.S13=I14>0?H1.K1:H1.L1;
}
else{
E6.S13=(I14<<(11-2))<<16>>16;
}
E6.S13=(E6.S13-2560*2)<<16>>16;
if(I14==0){
E6.S13=H1.L1;
}
if(E6.i14==0||E6.h14==G13){
System.arraycopy(E6.X4,0,E6.b6,0,t.E);
E6.T13=E6.S13;
}
}
if(E6.S13<0){
s4=~(~E6.S13>>1);
}
else{
s4=E6.S13>>1;
}
S14=(s4-9000)<<16>>16;
if(S14>0){
S14=0;
}
else if(S14<-14436){
S14=-14436;
}
B14.z6[0]=(short)S14;
B14.z6[1]=(short)S14;
B14.z6[2]=(short)S14;
B14.z6[3]=(short)S14;
S14=(S14*5443>>15)<<16>>16;
B14.A6[0]=(short)S14;
B14.A6[1]=(short)S14;
B14.A6[2]=(short)S14;
B14.A6[3]=(short)S14;
}
if(P13[F6]>1023){
s4=H1.K1;
}
else if(P13[F6]<-1024){
s4=H1.L1;
}
else{
s4=((P13[F6]<<5)*3277>>15)<<16>>16;
}
if(s4<0){
s4=~(~s4>>5);
}
else{
s4>>=5;
}
E6.b14=H1.C2((E6.b14*29491>>15)<<16>>16,s4,U1);
J14=H1.v2((E6.Q13+1)<<16>>16,10,U1);
J14=H1.o2(J14,E6.R13,U1);
if(J14>1024){
J14=16384;
}
else if(J14<-2048){
J14=H1.L1;
}
else{
J14=(J14<<4)<<16>>16;
}
K14=H1.d2(J14,E6.S13,U1);
for(o=t.E-1;
o>=0;
o--){
L14[o]=(short)H1.o2(J14,E6.X4[o],U1);
}
J14=(16384-J14)<<16>>16;
K14=H1.Y1(K14,J14,E6.T13,U1);
for(o=t.E-1;
o>=0;
o--){
L14[o]=(short)H1.C2(L14[o],H1.o2(J14,E6.b6[o],U1),U1);
E5=L14[o]<<1;
if(E5!=((E5<<16)>>16)){
U1[0]=1;
E5=L14[o]>0?H1.K1:H1.L1;
}
L14[o]=(short)((E5<<16)>>16);
}
Y14=(E6.Y13-2457)<<16>>16;
Y14=(4096-H1.o2(Y14,9830,U1))<<16>>16;
if(Y14>4095){
Y14=H1.K1;
}
else if(Y14<0){
Y14=0;
}
else{
Y14=(Y14<<3)<<16>>16;
}
X14=U11.G12(E6.U13,3);
R4.t5(L14,0,Z14,0,t.E,U1);
System.arraycopy(Z14,0,a15,0,t.E);
for(o=t.E-1;
o>=0;
o--){
a15[o]=(short)H1.C2(a15[o],H1.o2(Y14,E6.X13[o+X14*t.E],U1),U1);
}
R4.x5(Z14,0,t.G,t.E,U1);
R4.x5(a15,0,t.G,t.E,U1);
System.arraycopy(Z14,0,A14.S8,0,t.E);
R4.n5(Z14,0,L14,0,t.E,U1);
R4.n5(a15,0,b15,0,t.E,U1);
R4.f5(L14,0,P14,0,U1);
R4.f5(b15,0,c15,0,U1);
for(o=0;
o<=t.E;
o++){
G14[H14+o]=P14[o];
G14[H14+t.E+1+o]=P14[o];
G14[H14+2*(t.E+1)+o]=P14[o];
G14[H14+3*(t.E+1)+o]=P14[o];
}
U11.t12(P14,1,u12,0,U1);
Q14=H1.K1;
for(o=0;
o<t.E;
o++){
E5=(u12[o]*u12[o])>>15;
if(E5<=0x00007fff){
s4=(H1.K1-E5)<<16>>16;
}
else{
U1[0]=1;
s4=0;
}
Q14=H1.o2(Q14,s4,U1);
}
Z2.x3(Q14,v14,w14,U1);
final int g15=v14[0];
final int h15=w14[0];
T14=H1.v2((g15-15)<<16>>16,12,U1);
T14=H1.H2(H1.E2(0,H1.C2(T14,H1.H2(h15,15-12,U1),U1),U1),1,U1);
E6.Y13=H1.C2(H1.o2(29491,E6.Y13,U1),H1.o2(3277,T14,U1),U1);
K14=H1.z2(K14,10,U1);
K14=H1.R1(K14,4*65536,U1);
K14=H1.W1(K14,H1.x2(T14,4,U1),U1);
K14=H1.R1(K14,H1.x2(E6.b14,5,U1),U1);
M14=(K14>>16)<<16>>16;
N14=(H1.z2(H1.W1(K14,M14<<16,U1),1,U1)<<16)>>16;
O14=(Z2.A3(M14,N14,U1)<<16)>>16;
for(o=0;
o<4;
o++){
U11.L12(E6.U13,R14,0,U1);
for(k3=t.y-1;
k3>=0;
k3--){
R14[k3]=(short)H1.o2(O14,R14[k3],U1);
}
G3.k4(c15,0,R14,0,E14,F14+o*t.y,t.y,y14,z14,1);
}
C14.Q7=20;
C14.R7=0;
if(D14==I13){
f15=E6.Q13;
if(f15>32){
f15=32;
}
else if(f15<=0){
f15=8;
}
E5=f15<<10;
if(E5!=((E5<<16)>>16)){
U1[0]=1;
E5=f15>0?H1.K1:H1.L1;
}
s4=(E5<<16)>>16;
E6.R13=H1.M2(1<<10,s4);
E6.Q13=0;
System.arraycopy(E6.X4,0,E6.b6,0,t.E);
E6.T13=E6.S13;
E6.S13=(E6.S13-256)<<16>>16;
if(E6.S13<0){
E6.S13=0;
}
}
if(E6.e14!=0&&(E6.f14!=0||(E6.f14==0&&E6.g14!=0))){
E6.Q13=0;
E6.i14=1;
}
}
private static final short[]i15=new short[1];
private static final short[]j15=new short[1];
public static void k15(d E6,short[]o5,int p5,short[]h,int l15,int[]U1){
int m15;
int E5;
int n15;
int o15;
int S13;
E6.W13+=t.E;
if(E6.W13==80){
E6.W13=0;
}
for(int o=0;
o<t.E;
o++){
E6.V13[E6.W13+o]=o5[p5+o];
}
m15=0;
for(int o=t.w-1;
o>=0;
o--){
E5=h[l15+o]*h[l15+o];
if(E5!=0x40000000){
E5=E5<<1;
}
else{
E5=H1.I1;
}
m15=H1.R1(m15,E5,U1);
}
Z2.x3(m15,i15,j15,U1);
n15=i15[0];
o15=j15[0];
E5=n15<<10;
if(E5!=((E5<<16)>>16)){
U1[0]=1;
E5=n15>0?H1.K1:H1.L1;
}
n15=(E5<<16)>>16;
if(o15<0){
o15=~(~o15>>5);
}
else{
o15>>=5;
}
S13=(n15+o15)<<16>>16;
S13=(S13-(7497+1024))<<16>>16;
E6.a14+=1;
if(E6.a14==K13){
E6.a14=0;
}
E6.Z13[E6.a14]=(short)S13;
}
public static int p15(d E6,int q15,int[]U1){
int r15;
int s15;
if(q15==4||q15==5||q15==6||((E6.h14==H13||E6.h14==I13)&&(q15==7||q15==3||q15==2))){
r15=H13;
if(E6.h14==I13&&(q15==6||q15==4||q15==2||q15==7)){
r15=I13;
}
E6.Q13+=1;
if(q15!=5&&E6.Q13>J13){
r15=I13;
}
}
else{
r15=G13;
E6.Q13=0;
}
if(E6.i14==0&&q15==5){
E6.d14=0;
}
E6.d14=H1.C2(E6.d14,1,U1);
E6.g14=0;
if(q15==4||q15==5||q15==6||q15==2||q15==7){
s15=H13;
if(q15==7&&r15==G13){
s15=G13;
}
}
else{
s15=G13;
}
if(s15==G13){
E6.c14=M13;
}
else if(E6.d14>L13){
E6.g14=1;
E6.d14=0;
E6.c14=0;
}
else if(E6.c14==0){
E6.d14=0;
}
else{
E6.c14-=1;
}
if(r15!=G13){
E6.e14=0;
E6.f14=0;
if(q15==4){
E6.e14=1;
}
else if(q15==5){
E6.e14=1;
E6.f14=1;
}
else if(q15==6){
E6.e14=1;
E6.g14=0;
}
}
return r15;
}
}
final class t15{
private t15(){
}
public static final int u15=9;
public static final int v15=9;
public static final int w15=t.L+t.M;
public static final short[][]x15={
r3.y15,r3.z15,r3.A15,r3.B15,r3.C15,r3.D15,r3.E15,r3.F15,r3.G15,}
;
public static final class d{
public short[]H15;
public short[]b6;
public short[]y14;
public int I15;
public int J15;
public int X7;
public int Z7;
public int e;
public short[]K15;
public int L15;
public int a8;
public short[]E7;
public short[]M15;
public s7.d N15;
public short[]O15;
public N7.d P15;
public j8.D8 Q15;
public H8.d A14;
public j8.k8 R15;
public j8.o8 S15;
public s6.d x8;
public k11.d T15;
public F13.d U15;
public int[]V15;
public d(){
this.H15=new short[t.y+t.L+t.M];
this.b6=new short[t.E];
this.y14=new short[t.E];
this.I15=0;
this.J15=0;
this.X7=0;
this.Z7=0;
this.e=0;
this.K15=new short[u15];
this.L15=0;
this.a8=0;
this.E7=new short[1];
this.M15=new short[v15];
this.N15=new s7.d();
this.O15=new short[1];
this.P15=new N7.d();
this.Q15=new j8.D8();
this.A14=new H8.d();
this.R15=new j8.k8();
this.S15=new j8.o8();
this.x8=new s6.d();
this.T15=new k11.d();
this.U15=new F13.d();
this.V15=new int[1];
W15();
}
public int W15(){
this.L15=40;
this.a8=0;
this.E7[0]=0;
this.V15[0]=0;
for(int o=0;
o<v15;
o++){
this.M15[o]=0;
}
this.A14.reset();
this.R15.reset();
this.S15.reset();
this.P15.reset();
this.Q15.reset();
this.N15.reset();
this.T15.reset();
this.U15.reset();
this.x8.reset();
X15(this,t.Y);
return 0;
}
}
public static int X15(d e,int F6){
for(int o=0;
o<t.L+t.M;
o++){
e.H15[o]=0;
}
if(F6!=t.g1){
for(int o=0;
o<t.E;
o++){
e.y14[o]=0;
}
}
e.I15=t.S;
e.J15=40;
e.V15[0]=0;
if(F6!=t.g1){
final short[]W15={
30000,26000,21000,15000,8000,0,-8000,-15000,-21000,-26000}
;
System.arraycopy(W15,0,e.b6,0,t.E);
}
e.X7=0;
e.Z7=0;
e.e=0;
e.L15=40;
e.a8=0;
e.E7[0]=0;
if(F6!=t.g1){
for(int o=0;
o<u15;
o++){
e.K15[o]=0;
}
}
for(int o=0;
o<v15;
o++){
e.M15[o]=0;
}
e.P15.reset();
if(F6!=t.g1){
e.Q15.reset();
}
e.A14.reset();
e.R15.reset();
e.S15.reset();
if(F6!=t.g1){
e.x8.reset();
}
e.N15.reset();
e.O15[0]=21845;
e.T15.reset();
if(F6!=t.g1){
e.U15.reset();
}
return 0;
}
private static final short[]Y15=new short[t.E];
private static final short[]Z15=new short[t.E];
private static final short[]a16=new short[t.E];
private static final short[]b16=new short[t.E];
private static final short[]c16=new short[t.y];
private static final short[]d16=new short[t.y];
private static final short[]e16=new short[t.y];
private static final short[]f16=new short[1];
private static final short[]g16=new short[1];
private static final short[]h16=new short[1];
private static final short[]i16=new short[1];
private static final short[]j16=new short[1];
public static void k16(d E6,int F6,short[]Q12,int R12,int q15,short[]E14,int F14,short[]G14,int H14){
final short[]f6=Y15;
final short[]d6=Z15;
final short[]l16=a16;
final short[]m16=b16;
final short[]G6=c16;
final short[]n16=d16;
final short[]o16=e16;
int o;
int E4=0;
int c11;
int U8;
int p16=0;
int Q10;
int U7;
int q16;
int r16;
int s16;
int E11;
int Z10;
int a11;
int t16;
int u16;
int F11;
int s4;
int E5;
int d11;
int A13;
int w13;
int v16;
int P10=0;
int j=0;
int Y7=0;
final int[]U1=E6.V15;
int w16=R12;
final int x16=F13.p15(E6.U15,q15,U1);
if(x16!=F13.G13){
X15(E6,t.g1);
F13.x14(E6.U15,E6.y14,0,E6.A14,E6.x8,E6.P15,x16,F6,Q12,w16,E14,F14,G14,H14,U1);
R4.n5(E6.A14.S8,0,E6.b6,0,t.E,U1);
j8.G8(E6.Q15,E6.A14.S8,0,U1);
E6.U15.h14=x16;
return;
}
if(q15==t.B1||q15==t.F1||q15==t.A1){
j=1;
if(q15==t.F1||q15==t.A1){
U11.N12(E6.O15,r3.y16[F6],x15[F6],Q12,w16,U1);
}
}
else if(q15==t.z1){
Y7=1;
}
if(j!=0){
E6.e+=1;
}
else if(E6.e==6){
E6.e=5;
}
else{
E6.e=0;
}
if(E6.e>6){
E6.e=6;
}
if(E6.U15.h14==F13.H13){
E6.e=5;
E6.X7=0;
}
else if(E6.U15.h14==F13.I13){
E6.e=5;
E6.X7=1;
}
System.arraycopy(E6.A14.S8,0,l16,0,t.E);
if(F6!=t.f1){
H8.Y8(E6.A14,F6,j,Q12,w16,f6,0,U1);
w16+=3;
Y5.k6(E6.b6,0,f6,0,G14,H14,U1);
}
else{
H8.x9(E6.A14,j,Q12,w16,d6,0,f6,0,U1);
w16+=5;
Y5.a6(E6.b6,0,d6,0,f6,0,G14,H14,U1);
}
for(o=0;
o<t.E;
o++){
E6.b6[o]=f6[o];
}
int h6=H14;
P10=0;
v16=-1;
for(int M9=0;
M9<t.w;
M9+=t.y){
v16+=1;
P10=1-P10;
s16=M9;
if(M9==t.x){
if(F6!=t.Y&&F6!=t.Z){
s16=0;
}
}
U8=Q12[w16++];
if(F6!=t.f1){
d11=0;
if(F6==t.Y||F6==t.Z||F6==t.a1||F6==t.b1){
d11=1;
}
t16=5;
u16=9;
if(F6==t.d1){
t16=10;
u16=19;
}
Z10=(E6.J15-t16)<<16>>16;
if(Z10<t.K){
Z10=t.K;
}
a11=(Z10+u16)<<16>>16;
if(a11>t.L){
a11=t.L;
Z10=(a11-u16)<<16>>16;
}
D10.Y10(U8,Z10,a11,s16,E6.J15,f16,g16,d11,U1);
E4=f16[0];
c11=g16[0];
E6.L15=E4;
if(j!=0){
if(E6.J15<t.L){
E6.J15+=1;
}
E4=E6.J15;
c11=0;
if(E6.a8!=0&&E6.E7[0]>4&&(F6==t.Y||F6==t.Z||F6==t.a1)){
E4=E6.L15;
}
}
G3.B4(E6.H15,w15,E4,c11,t.y,1,U1);
}
else{
D10.f11(U8,t.J,t.L,s16,f16,g16,U1);
E4=f16[0];
c11=g16[0];
if(!(j==0&&(s16==0||U8<61))){
E6.L15=E4;
E4=E6.J15;
c11=0;
}
G3.B4(E6.H15,w15,E4,c11,t.y,0,U1);
}
f16[0]=(short)E4;
Q10=0;
if(F6==t.Y||F6==t.Z){
U8=Q12[w16++];
o=Q12[w16++];
R9.U9(v16,o,U8,G6,0,U1);
E5=E6.I15<<1;
if(E5!=((E5<<16)>>16)){
r16=E6.I15>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
else if(F6==t.a1){
U8=Q12[w16++];
o=Q12[w16++];
R9.a10(o,U8,G6,0);
E5=E6.I15<<1;
if(E5!=((E5<<16)>>16)){
r16=E6.I15>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
else if(F6==t.b1){
U8=Q12[w16++];
o=Q12[w16++];
R9.b10(o,U8,G6,0);
E5=E6.I15<<1;
if(E5!=((E5<<16)>>16)){
r16=E6.I15>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
else if(F6<=t.d1){
U8=Q12[w16++];
o=Q12[w16++];
R9.c10(o,U8,G6,0);
E5=E6.I15<<1;
if(E5!=((E5<<16)>>16)){
r16=E6.I15>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
else if(F6==t.e1){
R9.w10(Q12,w16,G6,0,U1);
w16+=7;
E5=E6.I15<<1;
if(E5!=((E5<<16)>>16)){
r16=E6.I15>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
else{
U8=Q12[w16++];
if(j!=0){
j8.z8(E6.R15,E6.e,h16,U1);
}
else{
h16[0]=(short)D10.F10(F6,U8);
}
j8.B8(E6.R15,j,E6.X7,h16,U1);
Q10=h16[0];
R9.C10(Q12,w16,G6,0);
w16+=10;
E5=Q10<<1;
if(E5!=((E5<<16)>>16)){
r16=Q10>0?H1.K1:H1.L1;
}
else{
r16=(E5<<16)>>16;
}
}
for(o=E4;
o<t.y;
o++){
s4=H1.o2(G6[o-E4],r16,U1);
G6[o]=(short)H1.C2(G6[o],s4,U1);
}
if(F6==t.Y){
if(P10!=0){
p16=Q12[w16++];
}
if(j==0){
D10.O10(E6.x8,F6,p16,G6,0,P10,h16,i16,U1);
}
else{
j8.z8(E6.R15,E6.e,h16,U1);
j8.w8(E6.S15,E6.x8,E6.e,i16,U1);
}
j8.B8(E6.R15,j,E6.X7,h16,U1);
j8.y8(E6.S15,j,E6.X7,i16,U1);
Q10=h16[0];
U7=i16[0];
r16=Q10;
if(r16>t.R){
r16=t.R;
}
}
else if(F6<=t.c1||F6==t.e1){
U8=Q12[w16++];
if(j==0){
D10.O10(E6.x8,F6,U8,G6,0,P10,h16,i16,U1);
}
else{
j8.z8(E6.R15,E6.e,h16,U1);
j8.w8(E6.S15,E6.x8,E6.e,i16,U1);
}
j8.B8(E6.R15,j,E6.X7,h16,U1);
j8.y8(E6.S15,j,E6.X7,i16,U1);
Q10=h16[0];
U7=i16[0];
r16=Q10;
if(r16>t.R){
r16=t.R;
}
if(F6==t.e1){
if(E6.J15>t.y+5){
if(r16<0){
r16=~(~r16>>2);
}
else{
r16=r16>>2;
}
}
}
}
else{
U8=Q12[w16++];
if(F6==t.d1){
if(j!=0){
j8.z8(E6.R15,E6.e,h16,U1);
}
else{
h16[0]=(short)D10.F10(F6,U8);
}
j8.B8(E6.R15,j,E6.X7,h16,U1);
Q10=h16[0];
U8=Q12[w16++];
if(j==0){
D10.L10(E6.x8,F6,U8,G6,0,i16,U1);
}
else{
j8.w8(E6.S15,E6.x8,E6.e,i16,U1);
}
j8.y8(E6.S15,j,E6.X7,i16,U1);
U7=i16[0];
r16=Q10;
if(r16>t.R){
r16=t.R;
}
}
else{
if(j==0){
D10.L10(E6.x8,F6,U8,G6,0,i16,U1);
}
else{
j8.w8(E6.S15,E6.x8,E6.e,i16,U1);
}
j8.y8(E6.S15,j,E6.X7,i16,U1);
U7=i16[0];
r16=Q10;
}
}
if(F6!=t.Y||P10==0){
E6.I15=Q10;
if(E6.I15>t.R){
E6.I15=t.R;
}
}
r16=H1.v2(r16,1,U1);
if(r16>16384){
for(o=0;
o<t.y;
o++){
s4=H1.o2(E6.H15[w15+o],r16,U1);
E5=H1.d2(s4,Q10,U1);
if(F6==t.f1){
if(E5<0){
E5=~(~E5>>1);
}
else{
E5=E5>>1;
}
}
n16[o]=(short)H1.K2(E5,U1);
}
}
if(j==0){
for(o=0;
o<8;
o++){
E6.M15[o]=E6.M15[o+1];
}
E6.M15[8]=(short)Q10;
}
if((E6.X7!=0||j!=0)&&E6.a8!=0&&(F6==t.Y||F6==t.Z||F6==t.a1)){
if(Q10>12288){
Q10=((((Q10-12288)>>1)+12288)<<16)>>16;
}
if(Q10>14745){
Q10=14745;
}
}
H8.H9(l16,0,E6.A14.S8,0,M9,m16,0,U1);
q16=N7.T7(E6.P15,F6,U7,m16,0,E6.Q15.E8,0,j,E6.X7,Y7,E6.Z7,E6.a8,E6.E7[0],U1);
if(F6>t.b1&&F6!=t.e1){
q16=U7;
}
if(F6<=t.e1){
E11=Q10;
F11=1;
}
else{
if(Q10<0){
E11=~(~Q10>>1);
}
else{
E11=Q10>>1;
}
F11=2;
}
for(o=0;
o<t.y;
o++){
o16[o]=E6.H15[w15+o];
E5=H1.d2(E6.H15[w15+o],E11,U1);
E5=H1.Y1(E5,G6[o],U7,U1);
E5=H1.x2(E5,F11,U1);
E6.H15[w15+o]=(short)H1.K2(E5,U1);
}
k11.w11(E6.T15);
if((F6==t.Y||F6==t.Z||F6==t.a1)&&E6.E7[0]>3&&E6.a8!=0&&j!=0){
k11.v11(E6.T15);
}
k11.z11(E6.T15,F6,o16,0,q16,Q10,G6,0,E11,F11,U1);
E5=0;
for(o=0;
o<t.y;
o++){
E5=H1.Y1(E5,o16[o],o16[o],U1);
}
if(E5<0){
E5=~(~E5>>1);
}
else{
E5=E5>>1;
}
E5=Z2.C3(E5,j16,U1);
s4=j16[0];
E5=H1.z2(E5,((s4>>1)+15)<<16>>16,U1);
if(E5<0){
w13=(~(~E5>>2)<<16)>>16;
}
else{
w13=((E5>>2)<<16)>>16;
}
if((F6==t.Y||F6==t.Z||F6==t.a1)&&E6.E7[0]>5&&E6.a8!=0&&E6.e<4&&((Y7!=0&&E6.Z7!=0)||j!=0||E6.X7!=0)){
A13=0;
if(Y7!=0&&j==0){
A13=1;
}
U12.t13(o16,0,w13,E6.K15,0,E6.E7[0],E6.X7,A13,U1);
}
if(!(E6.a8!=0&&(j!=0||E6.X7!=0)&&E6.e<4)){
for(o=0;
o<8;
o++){
E6.K15[o]=E6.K15[o+1];
}
E6.K15[8]=(short)w13;
}
if(r16>16384){
for(o=0;
o<t.y;
o++){
n16[o]=(short)H1.C2(n16[o],o16[o],U1);
}
Y6.r7(o16,0,n16,0,t.y,U1);
U1[0]=0;
G3.k4(G14,h6,n16,0,E14,F14+M9,t.y,E6.y14,0,0);
}
else{
U1[0]=0;
G3.k4(G14,h6,o16,0,E14,F14+M9,t.y,E6.y14,0,0);
}
if(U1[0]!=0){
for(o=t.L+t.M+t.y-1;
o>=0;
o--){
if(E6.H15[o]<0){
E6.H15[o]=(short)(~(~E6.H15[o]>>2));
}
else{
E6.H15[o]=(short)(E6.H15[o]>>2);
}
}
for(o=t.y-1;
o>=0;
o--){
if(o16[o]<0){
o16[o]=(short)(~(~o16[o]>>2));
}
else{
o16[o]=(short)(o16[o]>>2);
}
}
G3.k4(G14,h6,o16,0,E14,F14+M9,t.y,E6.y14,0,1);
}
else{
for(o=0;
o<t.E;
o++){
E6.y14[o]=E14[F14+M9+t.y-t.E+o];
}
}
System.arraycopy(E6.H15,t.y,E6.H15,0,t.L+t.M);
h6+=t.F;
E6.J15=E4;
}
E6.a8=s7.z7(E6.N15,E6.M15,0,E14,F14,E6.E7,U1);
F13.k15(E6.U15,E6.A14.S8,0,E14,F14,U1);
E6.X7=j;
E6.Z7=Y7;
j8.G8(E6.Q15,E6.A14.S8,0,U1);
E6.U15.h14=x16;
}
}
final class c{
private c(){
}
private static int z16(int A16,short[]B16,int C16){
int D16=0;
for(int o=0;
o<A16;
o++){
D16<<=1;
D16|=B16[C16+o];
}
return D16;
}
public static void E16(int F6,short[]F16,int G16,short[]H16,int I16){
int J16=G16;
final short[]K16=t15.x15[F6];
for(int o=0;
o<r3.y16[F6];
o++){
H16[I16+o]=(short)z16(K16[o],F16,J16);
J16+=K16[o];
}
}
public static final class d{
public t15.d L16;
public U12.d M16;
public U11.d12 N16;
public int O16;
public d(){
this.L16=new t15.d();
this.M16=new U12.d();
this.N16=new U11.d12();
this.O16=t.Y;
reset();
}
public int reset(){
t15.X15(this.L16,t.Y);
this.M16.reset();
this.N16.reset();
this.O16=t.Y;
return 0;
}
}
private static final short[]P16=new short[t.T+1];
private static final short[]Q16=new short[t.I];
public static void R16(d E6,int F6,short[]S16,int T16,int q15,short[]E14,int F14){
final short[]Q12=P16;
final short[]U16=Q16;
final int[]U1=E6.L16.V15;
if(q15==t.E1||q15==t.D1){
E16(t.g1,S16,T16,Q12,0);
}
else{
E16(F6,S16,T16,Q12,0);
}
t15.k16(E6.L16,F6,Q12,0,q15,E14,F14,U16,0);
U12.i13(E6.M16,F6,E14,F14,U16,0,U1);
U11.k12(E6.N16,E14,F14,t.w,U1);
for(int o=0;
o<t.w;
o++){
E14[F14+o]=(short)(E14[F14+o]&0xfff8);
}
}
}
final class f{
private f(){
}
public static final int V16=3;
public static final int W16=36;
public static final int X16=35;
public static void Y16(int Z16,byte[]a17,int b17,short[]c17){
if(Z16<t.q1){
final short[]d17=e17[Z16];
for(int o=r3.f17[Z16]-1;
o>=0;
o--){
c17[d17[o]]=(short)((a17[b17+(o>>3)]>>(~o&0x7))&0x01);
}
}
else{
for(int o=r3.f17[Z16]-1;
o>=0;
o--){
c17[o]=(short)((a17[b17+(o>>3)]>>(~o&0x7))&0x01);
}
}
}
public static final short[][]e17={
r3.g17,r3.h17,r3.i17,r3.j17,r3.k17,r3.l17,r3.m17,r3.n17,}
;
private static final short[]o17=new short[t.U];
public static int p17(c.d q17,int q15,byte[]r17,int s17,short[]t17,int u17){
int F6=t.Y;
int v17=t.F1;
final short[]w17=o17;
int x17=-1;
for(int o=0;
o<t.U;
o++){
w17[o]=0;
}
Y16(q15,r17,s17,w17);
x17=r3.y17[q15];
if(q15<=t.p1){
F6=q15;
v17=t.y1;
}
else if(q15==t.q1){
int z17=0;
for(int o=0;
o<V16;
o++){
z17|=w17[W16+o]<<o;
}
F6=z17;
if(w17[X16]==0){
v17=t.C1;
}
else{
v17=t.D1;
}
}
else if(q15<t.x1){
x17=-1;
}
else{
F6=q17.O16;
v17=t.F1;
}
if(x17!=-1){
c.R16(q17,F6,w17,0,v17,t17,u17);
q17.O16=F6;
}
return x17;
}
public static c.d g(){
return new c.d();
}
public static void k(c.d e,byte[]T3,short[]A17,int j){
int B17=(T3[0]>>3)&0x0f;
if(j!=0){
B17=t.x1;
}
p17(e,B17,T3,1,A17,0);
}
}
