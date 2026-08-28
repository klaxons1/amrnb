package amr;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
public final class Main{
private Main(){
}
static final int[]a={
13,14,16,18,20,21,27,32,6,1,1,1,1,1,1,1}
;
static final byte[]b={
0x23,0x21,0x41,0x4d,0x52,0x0a}
;
public static void main(String[]Q17)throws IOException{
if(Q17.length<2){
System.err.println("usage:");
System.err.println("  java amr.Main dec <in.amr|inDir> <out.pcm|outDir>");
System.err.println("  java amr.Main bench <in.amr> [<in.amr> ...]");
System.exit(2);
}
String R17=Q17[0];
if(R17.equals("dec")){
File S17=new File(Q17[1]);
File out=new File(Q17[2]);
if(S17.isDirectory()){
if(!out.isDirectory()&&!out.mkdirs()){
System.err.println("cannot create output dir: "+out);
System.exit(2);
}
File[]T17=S17.listFiles();
if(T17==null){
System.err.println("cannot list dir: "+S17);
System.exit(2);
}
for(File Z4:T17){
if(Z4.getName().endsWith(".amr")){
String i=Z4.getName().substring(0,Z4.getName().length()-4)+".pcm";
U17(Z4,new File(out,i));
System.out.println("decoded "+Z4.getName()+" -> "+i);
}
}
}
else{
U17(S17,out);
System.out.println("decoded "+S17+" -> "+out);
}
}
else if(R17.equals("bench")){
V17(Q17,1);
}
else{
System.err.println("unknown command: "+R17);
System.exit(2);
}
}
static void U17(File S17,File out)throws IOException{
byte[]l=W17(S17);
AmrNbDecoder X17=new AmrNbDecoder();
short[]i=X17.decodeAll(l);
FileOutputStream Y17=new FileOutputStream(out);
try{
byte[]Z17=new byte[i.length*2];
for(int o=0;
o<i.length;
o++){
Z17[o*2]=(byte)(i[o]&0xff);
Z17[o*2+1]=(byte)(i[o]>>8);
}
Y17.write(Z17);
}
finally{
Y17.close();
}
}
static void V17(String[]Q17,int a18)throws IOException{
byte[][]b18=new byte[Q17.length-a18][];
long c18=0;
for(int o=a18;
o<Q17.length;
o++){
b18[o-a18]=W17(new File(Q17[o]));
int m=d18(b18[o-a18])?6:0;
while(m+1<=b18[o-a18].length){
int B17=(b18[o-a18][m]>>3)&0x0f;
int r=a[B17];
if(m+r>b18[o-a18].length){
break;
}
m+=r;
c18++;
}
}
final double e18=c18*0.02;
f18(b18);
long g18=h18.i18;
for(int j18=0;
j18<3;
j18++){
long c5=System.nanoTime();
f18(b18);
long k18=(System.nanoTime()-c5)/1000000;
if(k18<g18){
g18=k18;
}
}
double l18=e18/(g18/1000.0);
System.out.printf("Java bench: frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",c18,e18,g18,l18,g18/(double)c18,c18*160.0/(g18/1000.0));
System.out.printf("::warning title=amr-java-bench::frames=%d audio=%.0fs elapsed=%dms realtime=%.0fx ms/frame=%.3f samples/s=%.0f%n",c18,e18,g18,l18,g18/(double)c18,c18*160.0/(g18/1000.0));
}
private static void f18(byte[][]b18){
AmrNbDecoder X17=new AmrNbDecoder();
byte[]h=new byte[32];
short[]i=new short[160];
for(int o=0;
o<b18.length;
o++){
byte[]l=b18[o];
int m=d18(l)?6:0;
while(m+1<=l.length){
int B17=(l[m]>>3)&0x0f;
int r=a[B17];
if(m+r>l.length){
break;
}
System.arraycopy(l,m,h,0,r);
X17.decode(h,i,0);
m+=r;
}
}
}
static boolean d18(byte[]l){
if(l.length<b.length){
return false;
}
for(int o=0;
o<b.length;
o++){
if(l[o]!=b[o]){
return false;
}
}
return true;
}
static byte[]W17(File Z4)throws IOException{
FileInputStream m18=new FileInputStream(Z4);
try{
long n18=Z4.length();
if(n18>o18.i18){
throw new IOException("file too large: "+Z4);
}
byte[]p18=new byte[(int)n18];
int m=0;
while(m<p18.length){
int s=m18.read(p18,m,p18.length-m);
if(s<0){
break;
}
m+=s;
}
return p18;
}
finally{
m18.close();
}
}
}
