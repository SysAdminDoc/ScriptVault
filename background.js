(()=>{var va=(t,r)=>()=>(r||t((r={exports:{}}).exports,r),r.exports);var Ga=va((Za,lr)=>{function st(){return"script_"+crypto.randomUUID()}function wt(t){if(!t||t<=0)return"0 B";const r=1024,a=["B","KB","MB","GB","TB"],e=Math.min(Math.floor(Math.log(t)/Math.log(r)),a.length-1);return parseFloat((t/Math.pow(r,e)).toFixed(1))+" "+a[e]}const Jr={enabled:!0,showBadge:!0,badgeColor:"#22c55e",theme:"dark",layout:"dark",notifyOnInstall:!0,notifyOnUpdate:!0,notifyOnError:!1,editorTheme:"material-darker",editorFontSize:13,editorTabSize:2,editorLineWrapping:!1,editorAutoComplete:!0,editorMatchBrackets:!0,editorAutoCloseBrackets:!0,editorHighlightActiveLine:!0,editorShowInvisibles:!1,editorKeyMap:"default",autoUpdate:!0,updateInterval:864e5,lastUpdateCheck:0,syncEnabled:!1,syncProvider:"none",syncInterval:36e5,lastSync:0,webdavUrl:"",webdavUsername:"",webdavPassword:"",googleDriveConnected:!1,googleDriveToken:"",googleDriveRefreshToken:"",googleClientId:"",googleDriveUser:null,dropboxToken:"",dropboxRefreshToken:"",dropboxUser:null,dropboxClientId:"",onedriveToken:"",onedriveRefreshToken:"",onedriveClientId:"",onedriveConnected:!1,onedriveUser:null,language:"auto",debugMode:!1,injectIntoFrames:!0,xhrTimeout:3e4,blacklist:[],badgeInfo:"running",autoReload:!1,pageFilterMode:"blacklist",blacklistedPages:"",whitelistedPages:"",deniedHosts:[],trustedSigningKeys:{},trashMode:"30"};(function(){"use strict";try{let ht=function(i,n){return typeof i=="function"&&(n=i,i={}),this.ondata=n,i},ha=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[fe],function(p){return nt(Ft(p.data[0],p.data[1]))},0,l)},Ft=function(i,n){return ne(i,n||{},0,0)},Hr=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[Oe],function(p){return nt(Lt(p.data[0],dt(p.data[1])))},1,l)},Lt=function(i,n){return be(i,{i:2},n&&n.out,n&&n.dictionary)},Ha=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[fe,Ue,function(){return[Wr]}],function(p){return nt(Wr(p.data[0],p.data[1]))},2,l)},Wr=function(i,n){n||(n={});var l=L(),p=i.length;l.p(i);var g=ne(i,n,gr(n),8),v=g.length;return fr(g,n),Se(g,v-8,l.d()),Se(g,v-4,p),g},ga=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[Oe,Pe,function(){return[kr]}],function(p){return nt(kr(p.data[0],p.data[1]))},3,l)},kr=function(i,n){var l=hr(i);return l+8>i.length&&$(6,"invalid gzip data"),be(i.subarray(l,-8),{i:2},n&&n.out||new a(Gr(i)),n&&n.dictionary)},Wa=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[fe,Je,function(){return[Kr]}],function(p){return nt(Kr(p.data[0],p.data[1]))},4,l)},Kr=function(i,n){n||(n={});var l=F();l.p(i);var p=ne(i,n,n.dictionary?6:2,4);return mr(p,n),Se(p,p.length-4,l.d()),p},ma=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),Dt(i,n,[Oe,Et,function(){return[Ar]}],function(p){return nt(Ar(p.data[0],dt(p.data[1])))},5,l)},Ar=function(i,n){return be(i.subarray(wr(i,n&&n.dictionary),-4),{i:2},n&&n.out,n&&n.dictionary)},Ka=function(i,n,l){return l||(l=n,n={}),typeof l!="function"&&$(7),i[0]==31&&i[1]==139&&i[2]==8?ga(i,n,l):(i[0]&15)!=8||i[0]>>4>7||(i[0]<<8|i[1])%31?Hr(i,n,l):ma(i,n,l)},Ja=function(i,n){return i[0]==31&&i[1]==139&&i[2]==8?kr(i,n):(i[0]&15)!=8||i[0]>>4>7||(i[0]<<8|i[1])%31?Lt(i,n):Ar(i,n)},St=function(i,n){if(n){for(var l=new a(i.length),p=0;p<i.length;++p)l[p]=i.charCodeAt(p);return l}if(Pr)return Pr.encode(i);for(var g=i.length,v=new a(i.length+(i.length>>1)),S=0,k=function(R){v[S++]=R},p=0;p<g;++p){if(S+5>v.length){var q=new a(S+8+(g-p<<1));q.set(v),v=q}var I=i.charCodeAt(p);I<128||n?k(I):I<2048?(k(192|I>>6),k(128|I&63)):I>55295&&I<57344?(I=65536+(I&1047552)|i.charCodeAt(++p)&1023,k(240|I>>18),k(128|I>>12&63),k(128|I>>6&63),k(128|I&63)):(k(224|I>>12),k(128|I>>6&63),k(128|I&63))}return he(v,0,S)},Tr=function(i,n){if(n){for(var l="",p=0;p<i.length;p+=16384)l+=String.fromCharCode.apply(null,i.subarray(p,p+16384));return l}else{if(Sr)return Sr.decode(i);var g=Vr(i),v=g.s,l=g.r;return l.length&&$(8),v}},Ya=function(i,n,l){l||(l=n,n={}),typeof l!="function"&&$(7);var p={};br(i,"",p,n);var g=Object.keys(p),v=g.length,S=0,k=0,q=v,I=new Array(v),R=[],G=function(){for(var Z=0;Z<R.length;++Z)R[Z]()},K=function(Z,ce){Jt(function(){l(Z,ce)})};Jt(function(){K=l});var de=function(){var Z=new a(k+22),ce=S,ge=k-S;k=0;for(var ue=0;ue<q;++ue){var re=I[ue];try{var ke=re.c.length;Gt(Z,k,re,re.f,re.u,ke);var Te=30+re.f.length+bt(re.extra),ye=k+Te;Z.set(re.c,ye),Gt(Z,S,re,re.f,re.u,ke,k,re.m),S+=16+Te+(re.m?re.m.length:0),k=ye+ke}catch(oe){return K(oe,null)}}_r(Z,S,I.length,ge,ce),K(null,Z)};v||de();for(var ie=function(Z){var ce=g[Z],ge=p[ce],ue=ge[0],re=ge[1],ke=L(),Te=ue.length;ke.p(ue);var ye=St(ce),oe=ye.length,te=re.comment,me=te&&St(te),_e=me&&me.length,De=bt(re.extra),Fe=re.level==0?0:8,Ce=function(Ne,Ge){if(Ne)G(),K(Ne,null);else{var Ee=Ge.length;I[Z]=we(re,{size:Te,crc:ke.d(),c:Ge,f:ye,m:me,u:oe!=ce.length||me&&te.length!=_e,compression:Fe}),S+=30+oe+De+Ee,k+=76+2*(oe+De)+(_e||0)+Ee,--v||de()}};if(oe>65535&&Ce($(11,0,1),null),!Fe)Ce(null,ue);else if(Te<16e4)try{Ce(null,Ft(ue,re))}catch(Ne){Ce(Ne,null)}else R.push(ha(ue,re,Ce))},le=0;le<q;++le)ie(le);return G},wa=function(i,n){n||(n={});var l={},p=[];br(i,"",l,n);var g=0,v=0;for(var S in l){var k=l[S],q=k[0],I=k[1],R=I.level==0?0:8,G=St(S),K=G.length,de=I.comment,ie=de&&St(de),le=ie&&ie.length,Z=bt(I.extra);K>65535&&$(11);var ce=R?Ft(q,I):q,ge=ce.length,ue=L();ue.p(q),p.push(we(I,{size:q.length,crc:ue.d(),c:ce,f:G,m:ie,u:K!=S.length||ie&&de.length!=le,o:g,compression:R})),g+=30+K+Z+ge,v+=76+2*(K+Z)+(le||0)+ge}for(var re=new a(v+22),ke=g,Te=v-g,ye=0;ye<p.length;++ye){var G=p[ye];Gt(re,G.o,G,G.f,G.u,G.c.length);var oe=30+G.f.length+bt(G.extra);re.set(G.c,G.o+oe),Gt(re,g,G,G.f,G.u,G.c.length,G.o,G.m),g+=16+oe+(G.m?G.m.length:0)}return _r(re,g,p.length,Te,ke),re},Xa=function(i,n,l){l||(l=n,n={}),typeof l!="function"&&$(7);var p=[],g=function(){for(var Z=0;Z<p.length;++Z)p[Z]()},v={},S=function(Z,ce){Jt(function(){l(Z,ce)})};Jt(function(){S=l});for(var k=i.length-22;qe(i,k)!=101010256;--k)if(!k||i.length-k>65558)return S($(13,0,1),null),g;var q=Ze(i,k+8);if(q){var I=q,R=qe(i,k+16),G=R==4294967295||I==65535;if(G){var K=qe(i,k-12);G=qe(i,K)==101075792,G&&(I=q=qe(i,K+32),R=qe(i,K+48))}for(var de=n&&n.filter,ie=function(Z){var ce=Fr(i,R,G),ge=ce[0],ue=ce[1],re=ce[2],ke=ce[3],Te=ce[4],ye=ce[5],oe=Br(i,ye);R=Te;var te=function(_e,De){_e?(g(),S(_e,null)):(De&&(v[ke]=De),--q||S(null,v))};if(!de||de({name:ke,size:ue,originalSize:re,compression:ge}))if(!ge)te(null,he(i,oe,oe+ue));else if(ge==8){var me=i.subarray(oe,oe+ue);if(re<524288||ue>.8*re)try{te(null,Lt(me,{out:new a(re)}))}catch(_e){te(_e,null)}else p.push(Hr(me,{size:re},te))}else te($(14,"unknown compression type "+ge,1),null);else te(null,null)},le=0;le<I;++le)ie(le)}else S(null,{});return g},ya=function(i,n){for(var l={},p=i.length-22;qe(i,p)!=101010256;--p)(!p||i.length-p>65558)&&$(13);var g=Ze(i,p+8);if(!g)return{};var v=qe(i,p+16),S=v==4294967295||g==65535;if(S){var k=qe(i,p-12);S=qe(i,k)==101075792,S&&(g=qe(i,k+32),v=qe(i,k+48))}for(var q=n&&n.filter,I=0;I<g;++I){var R=Fr(i,v,S),G=R[0],K=R[1],de=R[2],ie=R[3],le=R[4],Z=R[5],ce=Br(i,Z);v=le,(!q||q({name:ie,size:K,originalSize:de,compression:G}))&&(G?G==8?l[ie]=Lt(i.subarray(ce,ce+K),{out:new a(de)}):$(14,"unknown compression type "+G):l[ie]=he(i,ce,ce+K))}return l};var t={},r=(function(i,n,l,p,g){var v=new Worker(t[n]||(t[n]=URL.createObjectURL(new Blob([i+';addEventListener("error",function(e){e=e.error;postMessage({$e$:[e.message,e.code,e.stack]})})'],{type:"text/javascript"}))));return v.onmessage=function(S){var k=S.data,q=k.$e$;if(q){var I=new Error(q[0]);I.code=q[1],I.stack=q[2],g(I,null)}else g(null,k)},v.postMessage(l,p),v}),a=Uint8Array,e=Uint16Array,s=Int32Array,o=new a([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),c=new a([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),u=new a([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),d=function(i,n){for(var l=new e(31),p=0;p<31;++p)l[p]=n+=1<<i[p-1];for(var g=new s(l[30]),p=1;p<30;++p)for(var v=l[p];v<l[p+1];++v)g[v]=v-l[p]<<5|p;return{b:l,r:g}},f=d(o,2),h=f.b,y=f.r;h[28]=258,y[258]=28;for(var _=d(c,0),x=_.b,E=_.r,P=new e(32768),A=0;A<32768;++A){var X=(A&43690)>>1|(A&21845)<<1;X=(X&52428)>>2|(X&13107)<<2,X=(X&61680)>>4|(X&3855)<<4,P[A]=((X&65280)>>8|(X&255)<<8)>>1}for(var Q=(function(i,n,l){for(var p=i.length,g=0,v=new e(n);g<p;++g)i[g]&&++v[i[g]-1];var S=new e(n);for(g=1;g<n;++g)S[g]=S[g-1]+v[g-1]<<1;var k;if(l){k=new e(1<<n);var q=15-n;for(g=0;g<p;++g)if(i[g])for(var I=g<<4|i[g],R=n-i[g],G=S[i[g]-1]++<<R,K=G|(1<<R)-1;G<=K;++G)k[P[G]>>q]=I}else for(k=new e(p),g=0;g<p;++g)i[g]&&(k[g]=P[S[i[g]-1]++]>>15-i[g]);return k}),ae=new a(288),A=0;A<144;++A)ae[A]=8;for(var A=144;A<256;++A)ae[A]=9;for(var A=256;A<280;++A)ae[A]=7;for(var A=280;A<288;++A)ae[A]=8;for(var z=new a(32),A=0;A<32;++A)z[A]=5;var V=Q(ae,9,0),C=Q(ae,9,1),W=Q(z,5,0),Y=Q(z,5,1),N=function(i){for(var n=i[0],l=1;l<i.length;++l)i[l]>n&&(n=i[l]);return n},B=function(i,n,l){var p=n/8|0;return(i[p]|i[p+1]<<8)>>(n&7)&l},pe=function(i,n){var l=n/8|0;return(i[l]|i[l+1]<<8|i[l+2]<<16)>>(n&7)},ve=function(i){return(i+7)/8|0},he=function(i,n,l){return(n==null||n<0)&&(n=0),(l==null||l>i.length)&&(l=i.length),new a(i.subarray(n,l))},Ve={UnexpectedEOF:0,InvalidBlockType:1,InvalidLengthLiteral:2,InvalidDistance:3,StreamFinished:4,NoStreamHandler:5,InvalidHeader:6,NoCallback:7,InvalidUTF8:8,ExtraFieldTooLong:9,InvalidDate:10,FilenameTooLong:11,StreamFinishing:12,InvalidZipData:13,UnknownCompressionMethod:14},ee=["unexpected EOF","invalid block type","invalid length/literal","invalid distance","stream finished","no stream handler",,"no callback","invalid UTF-8 data","extra field too long","date not in range 1980-2099","filename too long","stream finishing","invalid zip data"],$=function(i,n,l){var p=new Error(n||ee[i]);if(p.code=i,Error.captureStackTrace&&Error.captureStackTrace(p,$),!l)throw p;return p},be=function(i,n,l,p){var g=i.length,v=p?p.length:0;if(!g||n.f&&!n.l)return l||new a(0);var S=!l,k=S||n.i!=2,q=n.i;S&&(l=new a(g*3));var I=function(zt){var Ht=l.length;if(zt>Ht){var $t=new a(Math.max(Ht*2,zt));$t.set(l),l=$t}},R=n.f||0,G=n.p||0,K=n.b||0,de=n.l,ie=n.d,le=n.m,Z=n.n,ce=g*8;do{if(!de){R=B(i,G,1);var ge=B(i,G+1,3);if(G+=3,ge)if(ge==1)de=C,ie=Y,le=9,Z=5;else if(ge==2){var Te=B(i,G,31)+257,ye=B(i,G+10,15)+4,oe=Te+B(i,G+5,31)+1;G+=14;for(var te=new a(oe),me=new a(19),_e=0;_e<ye;++_e)me[u[_e]]=B(i,G+_e*3,7);G+=ye*3;for(var De=N(me),Fe=(1<<De)-1,Ce=Q(me,De,1),_e=0;_e<oe;){var Ne=Ce[B(i,G,Fe)];G+=Ne&15;var ue=Ne>>4;if(ue<16)te[_e++]=ue;else{var Ge=0,Ee=0;for(ue==16?(Ee=3+B(i,G,3),G+=2,Ge=te[_e-1]):ue==17?(Ee=3+B(i,G,7),G+=3):ue==18&&(Ee=11+B(i,G,127),G+=7);Ee--;)te[_e++]=Ge}}var Qe=te.subarray(0,Te),We=te.subarray(Te);le=N(Qe),Z=N(We),de=Q(Qe,le,1),ie=Q(We,Z,1)}else $(1);else{var ue=ve(G)+4,re=i[ue-4]|i[ue-3]<<8,ke=ue+re;if(ke>g){q&&$(0);break}k&&I(K+re),l.set(i.subarray(ue,ke),K),n.b=K+=re,n.p=G=ke*8,n.f=R;continue}if(G>ce){q&&$(0);break}}k&&I(K+131072);for(var Mt=(1<<le)-1,rt=(1<<Z)-1,vt=G;;vt=G){var Ge=de[pe(i,G)&Mt],it=Ge>>4;if(G+=Ge&15,G>ce){q&&$(0);break}if(Ge||$(2),it<256)l[K++]=it;else if(it==256){vt=G,de=null;break}else{var ct=it-254;if(it>264){var _e=it-257,je=o[_e];ct=B(i,G,(1<<je)-1)+h[_e],G+=je}var gt=ie[pe(i,G)&rt],Ot=gt>>4;gt||$(3),G+=gt&15;var We=x[Ot];if(Ot>3){var je=c[Ot];We+=pe(i,G)&(1<<je)-1,G+=je}if(G>ce){q&&$(0);break}k&&I(K+131072);var Nt=K+ct;if(K<We){var Yt=v-We,Xt=Math.min(We,Nt);for(Yt+K<0&&$(3);K<Xt;++K)l[K]=p[Yt+K]}for(;K<Nt;++K)l[K]=l[K-We]}}n.l=de,n.p=vt,n.b=K,n.f=R,de&&(R=1,n.m=le,n.d=ie,n.n=Z)}while(!R);return K!=l.length&&S?he(l,0,K):l.subarray(0,K)},se=function(i,n,l){l<<=n&7;var p=n/8|0;i[p]|=l,i[p+1]|=l>>8},He=function(i,n,l){l<<=n&7;var p=n/8|0;i[p]|=l,i[p+1]|=l>>8,i[p+2]|=l>>16},Ke=function(i,n){for(var l=[],p=0;p<i.length;++p)i[p]&&l.push({s:p,f:i[p]});var g=l.length,v=l.slice();if(!g)return{t:U,l:0};if(g==1){var S=new a(l[0].s+1);return S[l[0].s]=1,{t:S,l:1}}l.sort(function(ke,Te){return ke.f-Te.f}),l.push({s:-1,f:25001});var k=l[0],q=l[1],I=0,R=1,G=2;for(l[0]={s:-1,f:k.f+q.f,l:k,r:q};R!=g-1;)k=l[l[I].f<l[G].f?I++:G++],q=l[I!=R&&l[I].f<l[G].f?I++:G++],l[R++]={s:-1,f:k.f+q.f,l:k,r:q};for(var K=v[0].s,p=1;p<g;++p)v[p].s>K&&(K=v[p].s);var de=new e(K+1),ie=m(l[R-1],de,0);if(ie>n){var p=0,le=0,Z=ie-n,ce=1<<Z;for(v.sort(function(Te,ye){return de[ye.s]-de[Te.s]||Te.f-ye.f});p<g;++p){var ge=v[p].s;if(de[ge]>n)le+=ce-(1<<ie-de[ge]),de[ge]=n;else break}for(le>>=Z;le>0;){var ue=v[p].s;de[ue]<n?le-=1<<n-de[ue]++-1:++p}for(;p>=0&&le;--p){var re=v[p].s;de[re]==n&&(--de[re],++le)}ie=n}return{t:new a(de),l:ie}},m=function(i,n,l){return i.s==-1?Math.max(m(i.l,n,l+1),m(i.r,n,l+1)):n[i.s]=l},j=function(i){for(var n=i.length;n&&!i[--n];);for(var l=new e(++n),p=0,g=i[0],v=1,S=function(q){l[p++]=q},k=1;k<=n;++k)if(i[k]==g&&k!=n)++v;else{if(!g&&v>2){for(;v>138;v-=138)S(32754);v>2&&(S(v>10?v-11<<5|28690:v-3<<5|12305),v=0)}else if(v>3){for(S(g),--v;v>6;v-=6)S(8304);v>2&&(S(v-3<<5|8208),v=0)}for(;v--;)S(g);v=1,g=i[k]}return{c:l.subarray(0,p),n}},D=function(i,n){for(var l=0,p=0;p<n.length;++p)l+=i[p]*n[p];return l},w=function(i,n,l){var p=l.length,g=ve(n+2);i[g]=p&255,i[g+1]=p>>8,i[g+2]=i[g]^255,i[g+3]=i[g+1]^255;for(var v=0;v<p;++v)i[g+v+4]=l[v];return(g+4+p)*8},T=function(i,n,l,p,g,v,S,k,q,I,R){se(n,R++,l),++g[256];for(var G=Ke(g,15),K=G.t,de=G.l,ie=Ke(v,15),le=ie.t,Z=ie.l,ce=j(K),ge=ce.c,ue=ce.n,re=j(le),ke=re.c,Te=re.n,ye=new e(19),oe=0;oe<ge.length;++oe)++ye[ge[oe]&31];for(var oe=0;oe<ke.length;++oe)++ye[ke[oe]&31];for(var te=Ke(ye,7),me=te.t,_e=te.l,De=19;De>4&&!me[u[De-1]];--De);var Fe=I+5<<3,Ce=D(g,ae)+D(v,z)+S,Ne=D(g,K)+D(v,le)+S+14+3*De+D(ye,me)+2*ye[16]+3*ye[17]+7*ye[18];if(q>=0&&Fe<=Ce&&Fe<=Ne)return w(n,R,i.subarray(q,q+I));var Ge,Ee,Qe,We;if(se(n,R,1+(Ne<Ce)),R+=2,Ne<Ce){Ge=Q(K,de,0),Ee=K,Qe=Q(le,Z,0),We=le;var Mt=Q(me,_e,0);se(n,R,ue-257),se(n,R+5,Te-1),se(n,R+10,De-4),R+=14;for(var oe=0;oe<De;++oe)se(n,R+3*oe,me[u[oe]]);R+=3*De;for(var rt=[ge,ke],vt=0;vt<2;++vt)for(var it=rt[vt],oe=0;oe<it.length;++oe){var ct=it[oe]&31;se(n,R,Mt[ct]),R+=me[ct],ct>15&&(se(n,R,it[oe]>>5&127),R+=it[oe]>>12)}}else Ge=V,Ee=ae,Qe=W,We=z;for(var oe=0;oe<k;++oe){var je=p[oe];if(je>255){var ct=je>>18&31;He(n,R,Ge[ct+257]),R+=Ee[ct+257],ct>7&&(se(n,R,je>>23&31),R+=o[ct]);var gt=je&31;He(n,R,Qe[gt]),R+=We[gt],gt>3&&(He(n,R,je>>5&8191),R+=c[gt])}else He(n,R,Ge[je]),R+=Ee[je]}return He(n,R,Ge[256]),R+Ee[256]},M=new s([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),U=new a(0),J=function(i,n,l,p,g,v){var S=v.z||i.length,k=new a(p+S+5*(1+Math.ceil(S/7e3))+g),q=k.subarray(p,k.length-g),I=v.l,R=(v.r||0)&7;if(n){R&&(q[0]=v.r>>3);for(var G=M[n-1],K=G>>13,de=G&8191,ie=(1<<l)-1,le=v.p||new e(32768),Z=v.h||new e(ie+1),ce=Math.ceil(l/3),ge=2*ce,ue=function(Er){return(i[Er]^i[Er+1]<<ce^i[Er+2]<<ge)&ie},re=new s(25e3),ke=new e(288),Te=new e(32),ye=0,oe=0,te=v.i||0,me=0,_e=v.w||0,De=0;te+2<S;++te){var Fe=ue(te),Ce=te&32767,Ne=Z[Fe];if(le[Ce]=Ne,Z[Fe]=Ce,_e<=te){var Ge=S-te;if((ye>7e3||me>24576)&&(Ge>423||!I)){R=T(i,q,0,re,ke,Te,oe,me,De,te-De,R),me=ye=oe=0,De=te;for(var Ee=0;Ee<286;++Ee)ke[Ee]=0;for(var Ee=0;Ee<30;++Ee)Te[Ee]=0}var Qe=2,We=0,Mt=de,rt=Ce-Ne&32767;if(Ge>2&&Fe==ue(te-rt))for(var vt=Math.min(K,Ge)-1,it=Math.min(32767,te),ct=Math.min(258,Ge);rt<=it&&--Mt&&Ce!=Ne;){if(i[te+Qe]==i[te+Qe-rt]){for(var je=0;je<ct&&i[te+je]==i[te+je-rt];++je);if(je>Qe){if(Qe=je,We=rt,je>vt)break;for(var gt=Math.min(rt,je-2),Ot=0,Ee=0;Ee<gt;++Ee){var Nt=te-rt+Ee&32767,Yt=le[Nt],Xt=Nt-Yt&32767;Xt>Ot&&(Ot=Xt,Ne=Nt)}}}Ce=Ne,Ne=le[Ce],rt+=Ce-Ne&32767}if(We){re[me++]=268435456|y[Qe]<<18|E[We];var zt=y[Qe]&31,Ht=E[We]&31;oe+=o[zt]+c[Ht],++ke[257+zt],++Te[Ht],_e=te+Qe,++ye}else re[me++]=i[te],++ke[i[te]]}}for(te=Math.max(te,_e);te<S;++te)re[me++]=i[te],++ke[i[te]];R=T(i,q,I,re,ke,Te,oe,me,De,te-De,R),I||(v.r=R&7|q[R/8|0]<<3,R-=7,v.h=Z,v.p=le,v.i=te,v.w=_e)}else{for(var te=v.w||0;te<S+I;te+=65535){var $t=te+65535;$t>=S&&(q[R/8|0]=I,$t=S),R=w(q,R+1,i.subarray(te,$t))}v.i=S}return he(k,0,p+ve(R)+g)},b=(function(){for(var i=new Int32Array(256),n=0;n<256;++n){for(var l=n,p=9;--p;)l=(l&1&&-306674912)^l>>>1;i[n]=l}return i})(),L=function(){var i=-1;return{p:function(n){for(var l=i,p=0;p<n.length;++p)l=b[l&255^n[p]]^l>>>8;i=l},d:function(){return~i}}},F=function(){var i=1,n=0;return{p:function(l){for(var p=i,g=n,v=l.length|0,S=0;S!=v;){for(var k=Math.min(S+2655,v);S<k;++S)g+=p+=l[S];p=(p&65535)+15*(p>>16),g=(g&65535)+15*(g>>16)}i=p,n=g},d:function(){return i%=65521,n%=65521,(i&255)<<24|(i&65280)<<8|(n&255)<<8|n>>8}}},ne=function(i,n,l,p,g){if(!g&&(g={l:1},n.dictionary)){var v=n.dictionary.subarray(-32768),S=new a(v.length+i.length);S.set(v),S.set(i,v.length),i=S,g.w=v.length}return J(i,n.level==null?6:n.level,n.mem==null?g.l?Math.ceil(Math.max(8,Math.min(13,Math.log(i.length)))*1.5):20:12+n.mem,l,p,g)},we=function(i,n){var l={};for(var p in i)l[p]=i[p];for(var p in n)l[p]=n[p];return l},Le=function(i,n,l){for(var p=i(),g=i.toString(),v=g.slice(g.indexOf("[")+1,g.lastIndexOf("]")).replace(/\s+/g,"").split(","),S=0;S<p.length;++S){var k=p[S],q=v[S];if(typeof k=="function"){n+=";"+q+"=";var I=k.toString();if(k.prototype)if(I.indexOf("[native code]")!=-1){var R=I.indexOf(" ",8)+1;n+=I.slice(R,I.indexOf("(",R))}else{n+=I;for(var G in k.prototype)n+=";"+q+".prototype."+G+"="+k.prototype[G].toString()}else n+=I}else l[q]=k}return n},Ae=[],$e=function(i){var n=[];for(var l in i)i[l].buffer&&n.push((i[l]=new i[l].constructor(i[l])).buffer);return n},Re=function(i,n,l,p){if(!Ae[l]){for(var g="",v={},S=i.length-1,k=0;k<S;++k)g=Le(i[k],g,v);Ae[l]={c:Le(i[S],g,v),e:v}}var q=we({},Ae[l].e);return r(Ae[l].c+";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage="+n.toString()+"}",l,q,$e(q),p)},Oe=function(){return[a,e,s,o,c,u,h,x,C,Y,P,ee,Q,N,B,pe,ve,he,$,be,Lt,nt,dt]},fe=function(){return[a,e,s,o,c,u,y,E,V,ae,W,z,P,M,U,Q,se,He,Ke,m,j,D,w,T,ve,he,J,ne,Ft,nt]},Ue=function(){return[fr,gr,Se,L,b]},Pe=function(){return[hr,Gr]},Je=function(){return[mr,Se,F]},Et=function(){return[wr]},nt=function(i){return postMessage(i,[i.buffer])},dt=function(i){return i&&{out:i.size&&new a(i.size),dictionary:i.dictionary}},Dt=function(i,n,l,p,g,v){var S=Re(l,p,g,function(k,q){S.terminate(),v(k,q)});return S.postMessage([i,n],n.consume?[i.buffer]:[]),function(){S.terminate()}},ut=function(i){return i.ondata=function(n,l){return postMessage([n,l],[n.buffer])},function(n){n.data.length?(i.push(n.data[0],n.data[1]),postMessage([n.data[0].length])):i.flush()}},Ut=function(i,n,l,p,g,v,S){var k,q=Re(i,p,g,function(I,R){I?(q.terminate(),n.ondata.call(n,I)):Array.isArray(R)?R.length==1?(n.queuedSize-=R[0],n.ondrain&&n.ondrain(R[0])):(R[1]&&q.terminate(),n.ondata.call(n,I,R[0],R[1])):S(R)});q.postMessage(l),n.queuedSize=0,n.push=function(I,R){n.ondata||$(5),k&&n.ondata($(4,0,1),null,!!R),n.queuedSize+=I.length,q.postMessage([I,k=R],[I.buffer])},n.terminate=function(){q.terminate()},v&&(n.flush=function(){q.postMessage([])})},Ze=function(i,n){return i[n]|i[n+1]<<8},qe=function(i,n){return(i[n]|i[n+1]<<8|i[n+2]<<16|i[n+3]<<24)>>>0},pr=function(i,n){return qe(i,n)+qe(i,n+4)*4294967296},Se=function(i,n,l){for(;l;++n)i[n]=l,l>>>=8},fr=function(i,n){var l=n.filename;if(i[0]=31,i[1]=139,i[2]=8,i[8]=n.level<2?4:n.level==9?2:0,i[9]=3,n.mtime!=0&&Se(i,4,Math.floor(new Date(n.mtime||Date.now())/1e3)),l){i[3]=8;for(var p=0;p<=l.length;++p)i[p+10]=l.charCodeAt(p)}},hr=function(i){(i[0]!=31||i[1]!=139||i[2]!=8)&&$(6,"invalid gzip data");var n=i[3],l=10;n&4&&(l+=(i[10]|i[11]<<8)+2);for(var p=(n>>3&1)+(n>>4&1);p>0;p-=!i[l++]);return l+(n&2)},Gr=function(i){var n=i.length;return(i[n-4]|i[n-3]<<8|i[n-2]<<16|i[n-1]<<24)>>>0},gr=function(i){return 10+(i.filename?i.filename.length+1:0)},mr=function(i,n){var l=n.level,p=l==0?0:l<6?1:l==9?3:2;if(i[0]=120,i[1]=p<<6|(n.dictionary&&32),i[1]|=31-(i[0]<<8|i[1])%31,n.dictionary){var g=F();g.p(n.dictionary),Se(i,2,g.d())}},wr=function(i,n){return((i[0]&15)!=8||i[0]>>4>7||(i[0]<<8|i[1])%31)&&$(6,"invalid zlib data"),(i[1]>>5&1)==+!n&&$(6,"invalid zlib data: "+(i[1]&32?"need":"unexpected")+" dictionary"),(i[1]>>3&4)+2},pt=(function(){function i(n,l){if(typeof n=="function"&&(l=n,n={}),this.ondata=l,this.o=n||{},this.s={l:0,i:32768,w:32768,z:32768},this.b=new a(98304),this.o.dictionary){var p=this.o.dictionary.subarray(-32768);this.b.set(p,32768-p.length),this.s.i=32768-p.length}}return i.prototype.p=function(n,l){this.ondata(ne(n,this.o,0,0,this.s),l)},i.prototype.push=function(n,l){this.ondata||$(5),this.s.l&&$(4);var p=n.length+this.s.z;if(p>this.b.length){if(p>2*this.b.length-32768){var g=new a(p&-32768);g.set(this.b.subarray(0,this.s.z)),this.b=g}var v=this.b.length-this.s.z;this.b.set(n.subarray(0,v),this.s.z),this.s.z=this.b.length,this.p(this.b,!1),this.b.set(this.b.subarray(-32768)),this.b.set(n.subarray(v),32768),this.s.z=n.length-v+32768,this.s.i=32766,this.s.w=32768}else this.b.set(n,this.s.z),this.s.z+=n.length;this.s.l=l&1,(this.s.z>this.s.w+8191||l)&&(this.p(this.b,l||!1),this.s.w=this.s.i,this.s.i-=2)},i.prototype.flush=function(){this.ondata||$(5),this.s.l&&$(4),this.p(this.b,!1),this.s.w=this.s.i,this.s.i-=2},i})(),ua=(function(){function i(n,l){Ut([fe,function(){return[ut,pt]}],this,ht.call(this,n,l),function(p){var g=new pt(p.data);onmessage=ut(g)},6,1)}return i})(),ot=(function(){function i(n,l){typeof n=="function"&&(l=n,n={}),this.ondata=l;var p=n&&n.dictionary&&n.dictionary.subarray(-32768);this.s={i:0,b:p?p.length:0},this.o=new a(32768),this.p=new a(0),p&&this.o.set(p)}return i.prototype.e=function(n){if(this.ondata||$(5),this.d&&$(4),!this.p.length)this.p=n;else if(n.length){var l=new a(this.p.length+n.length);l.set(this.p),l.set(n,this.p.length),this.p=l}},i.prototype.c=function(n){this.s.i=+(this.d=n||!1);var l=this.s.b,p=be(this.p,this.s,this.o);this.ondata(he(p,l,this.s.b),this.d),this.o=he(p,this.s.b-32768),this.s.b=this.o.length,this.p=he(this.p,this.s.p/8|0),this.s.p&=7},i.prototype.push=function(n,l){this.e(n),this.c(l)},i})(),Lr=(function(){function i(n,l){Ut([Oe,function(){return[ut,ot]}],this,ht.call(this,n,l),function(p){var g=new ot(p.data);onmessage=ut(g)},7,0)}return i})(),Or=(function(){function i(n,l){this.c=L(),this.l=0,this.v=1,pt.call(this,n,l)}return i.prototype.push=function(n,l){this.c.p(n),this.l+=n.length,pt.prototype.push.call(this,n,l)},i.prototype.p=function(n,l){var p=ne(n,this.o,this.v&&gr(this.o),l&&8,this.s);this.v&&(fr(p,this.o),this.v=0),l&&(Se(p,p.length-8,this.c.d()),Se(p,p.length-4,this.l)),this.ondata(p,l)},i.prototype.flush=function(){pt.prototype.flush.call(this)},i})(),La=(function(){function i(n,l){Ut([fe,Ue,function(){return[ut,pt,Or]}],this,ht.call(this,n,l),function(p){var g=new Or(p.data);onmessage=ut(g)},8,1)}return i})(),yr=(function(){function i(n,l){this.v=1,this.r=0,ot.call(this,n,l)}return i.prototype.push=function(n,l){if(ot.prototype.e.call(this,n),this.r+=n.length,this.v){var p=this.p.subarray(this.v-1),g=p.length>3?hr(p):4;if(g>p.length){if(!l)return}else this.v>1&&this.onmember&&this.onmember(this.r-p.length);this.p=p.subarray(g),this.v=0}ot.prototype.c.call(this,l),this.s.f&&!this.s.l&&!l&&(this.v=ve(this.s.p)+9,this.s={i:0},this.o=new a(0),this.push(new a(0),l))},i})(),da=(function(){function i(n,l){var p=this;Ut([Oe,Pe,function(){return[ut,ot,yr]}],this,ht.call(this,n,l),function(g){var v=new yr(g.data);v.onmember=function(S){return postMessage(S)},onmessage=ut(v)},9,0,function(g){return p.onmember&&p.onmember(g)})}return i})(),Nr=(function(){function i(n,l){this.c=F(),this.v=1,pt.call(this,n,l)}return i.prototype.push=function(n,l){this.c.p(n),pt.prototype.push.call(this,n,l)},i.prototype.p=function(n,l){var p=ne(n,this.o,this.v&&(this.o.dictionary?6:2),l&&4,this.s);this.v&&(mr(p,this.o),this.v=0),l&&Se(p,p.length-4,this.c.d()),this.ondata(p,l)},i.prototype.flush=function(){pt.prototype.flush.call(this)},i})(),Oa=(function(){function i(n,l){Ut([fe,Je,function(){return[ut,pt,Nr]}],this,ht.call(this,n,l),function(p){var g=new Nr(p.data);onmessage=ut(g)},10,1)}return i})(),vr=(function(){function i(n,l){ot.call(this,n,l),this.v=n&&n.dictionary?2:1}return i.prototype.push=function(n,l){if(ot.prototype.e.call(this,n),this.v){if(this.p.length<6&&!l)return;this.p=this.p.subarray(wr(this.p,this.v-1)),this.v=0}l&&(this.p.length<4&&$(6,"invalid zlib data"),this.p=this.p.subarray(0,-4)),ot.prototype.c.call(this,l)},i})(),pa=(function(){function i(n,l){Ut([Oe,Et,function(){return[ut,ot,vr]}],this,ht.call(this,n,l),function(p){var g=new vr(p.data);onmessage=ut(g)},11,0)}return i})(),$r=(function(){function i(n,l){this.o=ht.call(this,n,l)||{},this.G=yr,this.I=ot,this.Z=vr}return i.prototype.i=function(){var n=this;this.s.ondata=function(l,p){n.ondata(l,p)}},i.prototype.push=function(n,l){if(this.ondata||$(5),this.s)this.s.push(n,l);else{if(this.p&&this.p.length){var p=new a(this.p.length+n.length);p.set(this.p),p.set(n,this.p.length)}else this.p=n;this.p.length>2&&(this.s=this.p[0]==31&&this.p[1]==139&&this.p[2]==8?new this.G(this.o):(this.p[0]&15)!=8||this.p[0]>>4>7||(this.p[0]<<8|this.p[1])%31?new this.I(this.o):new this.Z(this.o),this.i(),this.s.push(this.p,l),this.p=null)}},i})(),Na=(function(){function i(n,l){$r.call(this,n,l),this.queuedSize=0,this.G=da,this.I=Lr,this.Z=pa}return i.prototype.i=function(){var n=this;this.s.ondata=function(l,p,g){n.ondata(l,p,g)},this.s.ondrain=function(l){n.queuedSize-=l,n.ondrain&&n.ondrain(l)}},i.prototype.push=function(n,l){this.queuedSize+=n.length,$r.prototype.push.call(this,n,l)},i})(),br=function(i,n,l,p){for(var g in i){var v=i[g],S=n+g,k=p;Array.isArray(v)&&(k=we(p,v[1]),v=v[0]),v instanceof a?l[S]=[v,k]:(l[S+="/"]=[new a(0),k],br(v,S,l,p))}},Pr=typeof TextEncoder<"u"&&new TextEncoder,Sr=typeof TextDecoder<"u"&&new TextDecoder,jr=0;try{Sr.decode(U,{stream:!0}),jr=1}catch{}var Vr=function(i){for(var n="",l=0;;){var p=i[l++],g=(p>127)+(p>223)+(p>239);if(l+g>i.length)return{s:n,r:he(i,l-1)};g?g==3?(p=((p&15)<<18|(i[l++]&63)<<12|(i[l++]&63)<<6|i[l++]&63)-65536,n+=String.fromCharCode(55296|p>>10,56320|p&1023)):g&1?n+=String.fromCharCode((p&31)<<6|i[l++]&63):n+=String.fromCharCode((p&15)<<12|(i[l++]&63)<<6|i[l++]&63):n+=String.fromCharCode(p)}},$a=(function(){function i(n){this.ondata=n,jr?this.t=new TextDecoder:this.p=U}return i.prototype.push=function(n,l){if(this.ondata||$(5),l=!!l,this.t){this.ondata(this.t.decode(n,{stream:!0}),l),l&&(this.t.decode().length&&$(8),this.t=null);return}this.p||$(4);var p=new a(this.p.length+n.length);p.set(this.p),p.set(n,this.p.length);var g=Vr(p),v=g.s,S=g.r;l?(S.length&&$(8),this.p=null):this.p=S,this.ondata(v,l)},i})(),Pa=(function(){function i(n){this.ondata=n}return i.prototype.push=function(n,l){this.ondata||$(5),this.d&&$(4),this.ondata(St(n),this.d=l||!1)},i})(),qr=function(i){return i==1?3:i<6?2:i==9?1:0},Br=function(i,n){return n+30+Ze(i,n+26)+Ze(i,n+28)},Fr=function(i,n,l){var p=Ze(i,n+28),g=Tr(i.subarray(n+46,n+46+p),!(Ze(i,n+8)&2048)),v=n+46+p,S=qe(i,n+20),k=l&&S==4294967295?zr(i,v):[S,qe(i,n+24),qe(i,n+42)],q=k[0],I=k[1],R=k[2];return[Ze(i,n+10),q,I,g,v+Ze(i,n+30)+Ze(i,n+32),R]},zr=function(i,n){for(;Ze(i,n)!=1;n+=4+Ze(i,n+2));return[pr(i,n+12),pr(i,n+4),pr(i,n+20)]},bt=function(i){var n=0;if(i)for(var l in i){var p=i[l].length;p>65535&&$(9),n+=p+4}return n},Gt=function(i,n,l,p,g,v,S,k){var q=p.length,I=l.extra,R=k&&k.length,G=bt(I);Se(i,n,S!=null?33639248:67324752),n+=4,S!=null&&(i[n++]=20,i[n++]=l.os),i[n]=20,n+=2,i[n++]=l.flag<<1|(v<0&&8),i[n++]=g&&8,i[n++]=l.compression&255,i[n++]=l.compression>>8;var K=new Date(l.mtime==null?Date.now():l.mtime),de=K.getFullYear()-1980;if((de<0||de>119)&&$(10),Se(i,n,de<<25|K.getMonth()+1<<21|K.getDate()<<16|K.getHours()<<11|K.getMinutes()<<5|K.getSeconds()>>1),n+=4,v!=-1&&(Se(i,n,l.crc),Se(i,n+4,v<0?-v-2:v),Se(i,n+8,l.size)),Se(i,n+12,q),Se(i,n+14,G),n+=16,S!=null&&(Se(i,n,R),Se(i,n+6,l.attrs),Se(i,n+10,S),n+=14),i.set(p,n),n+=q,G)for(var ie in I){var le=I[ie],Z=le.length;Se(i,n,+ie),Se(i,n+2,Z),i.set(le,n+4),n+=4+Z}return R&&(i.set(k,n),n+=R),n},_r=function(i,n,l,p,g){Se(i,n,101010256),Se(i,n+8,l),Se(i,n+10,l),Se(i,n+12,p),Se(i,n+16,g)},Kt=(function(){function i(n){this.filename=n,this.c=L(),this.size=0,this.compression=0}return i.prototype.process=function(n,l){this.ondata(null,n,l)},i.prototype.push=function(n,l){this.ondata||$(5),this.c.p(n),this.size+=n.length,l&&(this.crc=this.c.d()),this.process(n,l||!1)},i})(),ja=(function(){function i(n,l){var p=this;l||(l={}),Kt.call(this,n),this.d=new pt(l,function(g,v){p.ondata(null,g,v)}),this.compression=8,this.flag=qr(l.level)}return i.prototype.process=function(n,l){try{this.d.push(n,l)}catch(p){this.ondata(p,null,l)}},i.prototype.push=function(n,l){Kt.prototype.push.call(this,n,l)},i})(),Va=(function(){function i(n,l){var p=this;l||(l={}),Kt.call(this,n),this.d=new ua(l,function(g,v,S){p.ondata(g,v,S)}),this.compression=8,this.flag=qr(l.level),this.terminate=this.d.terminate}return i.prototype.process=function(n,l){this.d.push(n,l)},i.prototype.push=function(n,l){Kt.prototype.push.call(this,n,l)},i})(),qa=(function(){function i(n){this.ondata=n,this.u=[],this.d=1}return i.prototype.add=function(n){var l=this;if(this.ondata||$(5),this.d&2)this.ondata($(4+(this.d&1)*8,0,1),null,!1);else{var p=St(n.filename),g=p.length,v=n.comment,S=v&&St(v),k=g!=n.filename.length||S&&v.length!=S.length,q=g+bt(n.extra)+30;g>65535&&this.ondata($(11,0,1),null,!1);var I=new a(q);Gt(I,0,n,p,k,-1);var R=[I],G=function(){for(var Z=0,ce=R;Z<ce.length;Z++){var ge=ce[Z];l.ondata(null,ge,!1)}R=[]},K=this.d;this.d=0;var de=this.u.length,ie=we(n,{f:p,u:k,o:S,t:function(){n.terminate&&n.terminate()},r:function(){if(G(),K){var Z=l.u[de+1];Z?Z.r():l.d=1}K=1}}),le=0;n.ondata=function(Z,ce,ge){if(Z)l.ondata(Z,ce,ge),l.terminate();else if(le+=ce.length,R.push(ce),ge){var ue=new a(16);Se(ue,0,134695760),Se(ue,4,n.crc),Se(ue,8,le),Se(ue,12,n.size),R.push(ue),ie.c=le,ie.b=q+le+16,ie.crc=n.crc,ie.size=n.size,K&&ie.r(),K=1}else K&&G()},this.u.push(ie)}},i.prototype.end=function(){var n=this;if(this.d&2){this.ondata($(4+(this.d&1)*8,0,1),null,!0);return}this.d?this.e():this.u.push({r:function(){n.d&1&&(n.u.splice(-1,1),n.e())},t:function(){}}),this.d=3},i.prototype.e=function(){for(var n=0,l=0,p=0,g=0,v=this.u;g<v.length;g++){var S=v[g];p+=46+S.f.length+bt(S.extra)+(S.o?S.o.length:0)}for(var k=new a(p+22),q=0,I=this.u;q<I.length;q++){var S=I[q];Gt(k,n,S,S.f,S.u,-S.c-2,l,S.o),n+=46+S.f.length+bt(S.extra)+(S.o?S.o.length:0),l+=S.b}_r(k,n,this.u.length,p,l),this.ondata(null,k,!0),this.d=2},i.prototype.terminate=function(){for(var n=0,l=this.u;n<l.length;n++){var p=l[n];p.t()}this.d=2},i})(),fa=(function(){function i(){}return i.prototype.push=function(n,l){this.ondata(null,n,l)},i.compression=0,i})(),Ba=(function(){function i(){var n=this;this.i=new ot(function(l,p){n.ondata(null,l,p)})}return i.prototype.push=function(n,l){try{this.i.push(n,l)}catch(p){this.ondata(p,null,l)}},i.compression=8,i})(),Fa=(function(){function i(n,l){var p=this;l<32e4?this.i=new ot(function(g,v){p.ondata(null,g,v)}):(this.i=new Lr(function(g,v,S){p.ondata(g,v,S)}),this.terminate=this.i.terminate)}return i.prototype.push=function(n,l){this.i.terminate&&(n=he(n,0)),this.i.push(n,l)},i.compression=8,i})(),za=(function(){function i(n){this.onfile=n,this.k=[],this.o={0:fa},this.p=U}return i.prototype.push=function(n,l){var p=this;if(this.onfile||$(5),this.p||$(4),this.c>0){var g=Math.min(this.c,n.length),v=n.subarray(0,g);if(this.c-=g,this.d?this.d.push(v,!this.c):this.k[0].push(v),n=n.subarray(g),n.length)return this.push(n,l)}else{var S=0,k=0,q=void 0,I=void 0;this.p.length?n.length?(I=new a(this.p.length+n.length),I.set(this.p),I.set(n,this.p.length)):I=this.p:I=n;for(var R=I.length,G=this.c,K=G&&this.d,de=function(){var ce,ge=qe(I,k);if(ge==67324752){S=1,q=k,ie.d=null,ie.c=0;var ue=Ze(I,k+6),re=Ze(I,k+8),ke=ue&2048,Te=ue&8,ye=Ze(I,k+26),oe=Ze(I,k+28);if(R>k+30+ye+oe){var te=[];ie.k.unshift(te),S=2;var me=qe(I,k+18),_e=qe(I,k+22),De=Tr(I.subarray(k+30,k+=30+ye),!ke);me==4294967295?(ce=Te?[-2]:zr(I,k),me=ce[0],_e=ce[1]):Te&&(me=-1),k+=oe,ie.c=me;var Fe,Ce={name:De,compression:re,start:function(){if(Ce.ondata||$(5),!me)Ce.ondata(null,U,!0);else{var Ne=p.o[re];Ne||Ce.ondata($(14,"unknown compression type "+re,1),null,!1),Fe=me<0?new Ne(De):new Ne(De,me,_e),Fe.ondata=function(We,Mt,rt){Ce.ondata(We,Mt,rt)};for(var Ge=0,Ee=te;Ge<Ee.length;Ge++){var Qe=Ee[Ge];Fe.push(Qe,!1)}p.k[0]==te&&p.c?p.d=Fe:Fe.push(U,!0)}},terminate:function(){Fe&&Fe.terminate&&Fe.terminate()}};me>=0&&(Ce.size=me,Ce.originalSize=_e),ie.onfile(Ce)}return"break"}else if(G){if(ge==134695760)return q=k+=12+(G==-2&&8),S=3,ie.c=0,"break";if(ge==33639248)return q=k-=4,S=3,ie.c=0,"break"}},ie=this;k<R-4;++k){var le=de();if(le==="break")break}if(this.p=U,G<0){var Z=S?I.subarray(0,q-12-(G==-2&&8)-(qe(I,q-16)==134695760&&4)):I.subarray(0,k);K?K.push(Z,!!S):this.k[+(S==2)].push(Z)}if(S&2)return this.push(I.subarray(k),l);this.p=I.subarray(k)}l&&(this.c&&$(13),this.p=null)},i.prototype.register=function(n){this.o[n.compression]=n},i})(),Jt=typeof queueMicrotask=="function"?queueMicrotask:typeof setTimeout=="function"?setTimeout:function(i){i()};self.fflate={zipSync:wa,unzipSync:ya,strToU8:St,strFromU8:Tr,deflateSync:Ft,inflateSync:Lt},console.log("[ScriptVault] fflate inlined successfully, functions:",Object.keys(self.fflate).length)}catch(ht){console.error("[ScriptVault] fflate inline error:",ht.message,ht.stack)}})();var Ie=self.fflate,mt={webdav:{name:"WebDAV",icon:"\u2601\uFE0F",requiresAuth:!0,async upload(t,r){if(!r.webdavUrl)throw new Error("WebDAV URL is required");const a=`${r.webdavUrl.replace(/\/$/,"")}/scriptvault-backup.json`,e=btoa(`${r.webdavUsername}:${r.webdavPassword}`),s=await fetch(a,{method:"PUT",headers:{Authorization:`Basic ${e}`,"Content-Type":"application/json"},body:JSON.stringify(t)});if(!s.ok)throw new Error(`WebDAV upload failed: HTTP ${s.status}`);return{success:!0,timestamp:Date.now()}},async download(t){if(!t.webdavUrl)throw new Error("WebDAV URL is required");const r=`${t.webdavUrl.replace(/\/$/,"")}/scriptvault-backup.json`,a=btoa(`${t.webdavUsername}:${t.webdavPassword}`),e=await fetch(r,{method:"GET",headers:{Authorization:`Basic ${a}`}});if(e.status===404)return null;if(!e.ok)throw new Error(`WebDAV download failed: HTTP ${e.status}`);return await e.json()},async test(t){try{const r=t.webdavUrl.replace(/\/$/,""),a=btoa(`${t.webdavUsername}:${t.webdavPassword}`),e=await fetch(r,{method:"PROPFIND",headers:{Authorization:`Basic ${a}`,Depth:"0"}});return{success:e.ok||e.status===207}}catch(r){return{success:!1,error:r.message}}}},googledrive:{name:"Google Drive",icon:"\u{1F4C1}",requiresOAuth:!0,fileName:"scriptvault-backup.json",clientId:"287129963438-mcc1mod1m5jm8vjr3icb7ensdtcfq44l.apps.googleusercontent.com",async getToken(){return(await H.get()).googleDriveToken||null},async refreshToken(){const t=await H.get(),r=t.googleDriveRefreshToken;if(!r)return null;const a=t.googleClientId||this.clientId,e=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:a,grant_type:"refresh_token",refresh_token:r})});if(!e.ok)return console.warn("[CloudSync] Google token refresh failed:",e.status),(e.status===400||e.status===401)&&await H.set({googleDriveToken:"",googleDriveRefreshToken:""}),null;const s=await e.json();return s.access_token?(await H.set({googleDriveToken:s.access_token}),s.refresh_token&&await H.set({googleDriveRefreshToken:s.refresh_token}),s.access_token):null},async getValidToken(){let t=await this.getToken();return t?((await fetch("https://www.googleapis.com/drive/v3/about?fields=user",{headers:{Authorization:`Bearer ${t}`}})).ok||(t=await this.refreshToken()),t):null},async connect(){try{const t=await H.get(),r=t.googleClientId||this.clientId,a=chrome.identity.getRedirectURL(),e=["https://www.googleapis.com/auth/drive.file","https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/userinfo.profile"].join(" "),s=Array.from(crypto.getRandomValues(new Uint8Array(32)),A=>A.toString(16).padStart(2,"0")).join(""),o=new TextEncoder,c=await crypto.subtle.digest("SHA-256",o.encode(s)),u=btoa(String.fromCharCode(...new Uint8Array(c))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""),d="https://accounts.google.com/o/oauth2/v2/auth?"+new URLSearchParams({client_id:r,redirect_uri:a,response_type:"code",scope:e,access_type:"offline",prompt:"consent",code_challenge:u,code_challenge_method:"S256"}).toString(),f=await chrome.identity.launchWebAuthFlow({url:d,interactive:!0}),y=new URL(f).searchParams.get("code");if(!y)throw new Error("No authorization code received");const _=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:r,code:y,code_verifier:s,grant_type:"authorization_code",redirect_uri:a})});if(!_.ok){const A=await _.text();throw new Error("Token exchange failed: "+A)}const x=await _.json(),E=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${x.access_token}`}}),P=E.ok?await E.json():{};return await H.set({googleDriveToken:x.access_token,googleDriveRefreshToken:x.refresh_token||t.googleDriveRefreshToken||"",googleDriveConnected:!0,googleDriveUser:{email:P.email,name:P.name}}),{success:!0,user:{email:P.email,name:P.name,picture:P.picture}}}catch(t){return{success:!1,error:t.message}}},async disconnect(){try{const t=await this.getToken();t&&await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${t}`).catch(()=>{}),await H.set({googleDriveToken:"",googleDriveRefreshToken:"",googleDriveConnected:!1,googleDriveUser:null})}catch(t){console.warn("[CloudSync] Google disconnect error:",t)}return{success:!0}},async findFile(t){const r=encodeURIComponent(`name='${this.fileName}' and trashed=false`),a=await fetch(`https://www.googleapis.com/drive/v3/files?q=${r}&fields=files(id,name,modifiedTime)&spaces=drive`,{headers:{Authorization:`Bearer ${t}`}});if(!a.ok)throw new Error(`Failed to search files: ${a.status}`);return(await a.json()).files?.[0]||null},async upload(t,r){const a=await this.getValidToken();if(!a)throw new Error("Not authenticated with Google Drive");const e=await this.findFile(a),s={name:this.fileName,mimeType:"application/json"},o="-------ScriptVault"+crypto.getRandomValues(new Uint8Array(8)).reduce((f,h)=>f+h.toString(16).padStart(2,"0"),""),c=[`--${o}`,"Content-Type: application/json; charset=UTF-8","",JSON.stringify(s),`--${o}`,"Content-Type: application/json","",JSON.stringify(t),`--${o}--`].join(`\r
`),u=e?`https://www.googleapis.com/upload/drive/v3/files/${e.id}?uploadType=multipart`:"https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",d=await fetch(u,{method:e?"PATCH":"POST",headers:{Authorization:`Bearer ${a}`,"Content-Type":`multipart/related; boundary=${o}`},body:c});if(!d.ok){const f=await d.text();throw new Error(`Upload failed: ${f}`)}return{success:!0,timestamp:Date.now()}},async download(t){const r=await this.getValidToken();if(!r)throw new Error("Not authenticated with Google Drive");const a=await this.findFile(r);if(!a)return null;const e=await fetch(`https://www.googleapis.com/drive/v3/files/${a.id}?alt=media`,{headers:{Authorization:`Bearer ${r}`}});if(!e.ok)throw new Error(`Download failed: ${e.status}`);return await e.json()},async test(t){try{const r=await this.getValidToken();return r?{success:(await fetch("https://www.googleapis.com/drive/v3/about?fields=user",{headers:{Authorization:`Bearer ${r}`}})).ok}:{success:!1,error:"Not authenticated"}}catch(r){return{success:!1,error:r.message}}},async getStatus(t){try{if(t||(t=await H.get()),!t.googleDriveConnected||!t.googleDriveToken)return{connected:!1};const r=await this.getValidToken();if(!r)return{connected:!1};const a=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${r}`}});if(!a.ok)return{connected:!1};const e=await a.json();return{connected:!0,user:{email:e.email,name:e.name}}}catch{return{connected:!1}}}},dropbox:{name:"Dropbox",icon:"\u{1F4E6}",requiresOAuth:!0,fileName:"/scriptvault-backup.json",async connect(t){if(!t.dropboxClientId)throw new Error("Dropbox App Key is required. Create one at https://www.dropbox.com/developers/apps");const r=t.dropboxClientId,a=chrome.identity.getRedirectURL("dropbox"),e=Array.from(crypto.getRandomValues(new Uint8Array(32)),P=>P.toString(16).padStart(2,"0")).join(""),s=new TextEncoder,o=await crypto.subtle.digest("SHA-256",s.encode(e)),c=btoa(String.fromCharCode(...new Uint8Array(o))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""),u=Array.from(crypto.getRandomValues(new Uint8Array(16)),P=>P.toString(16).padStart(2,"0")).join(""),d="https://www.dropbox.com/oauth2/authorize?"+new URLSearchParams({client_id:r,redirect_uri:a,response_type:"code",token_access_type:"offline",code_challenge:c,code_challenge_method:"S256",state:u}).toString(),f=await chrome.identity.launchWebAuthFlow({url:d,interactive:!0}),h=new URL(f);if(h.searchParams.get("state")!==u)throw new Error("OAuth state mismatch - possible CSRF attack");const _=h.searchParams.get("code");if(!_)throw new Error("No authorization code received");const x=await fetch("https://api.dropboxapi.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:r,code:_,code_verifier:e,grant_type:"authorization_code",redirect_uri:a})});if(!x.ok){const P=await x.text();throw new Error("Token exchange failed: "+P)}const E=await x.json();return{success:!0,token:E.access_token,refreshToken:E.refresh_token||""}},async refreshToken(t){const r=t.dropboxRefreshToken,a=t.dropboxClientId;if(!r||!a)return null;const e=await fetch("https://api.dropboxapi.com/oauth2/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:a,grant_type:"refresh_token",refresh_token:r})});if(!e.ok)return console.warn("[CloudSync] Dropbox token refresh failed:",e.status),(e.status===400||e.status===401)&&await H.set({dropboxToken:"",dropboxRefreshToken:""}),null;const s=await e.json();return s.access_token?(await H.set({dropboxToken:s.access_token}),s.access_token):null},async getValidToken(t){return t.dropboxToken?(await fetch("https://api.dropboxapi.com/2/users/get_current_account",{method:"POST",headers:{Authorization:`Bearer ${t.dropboxToken}`}})).ok?t.dropboxToken:await this.refreshToken(t):null},async disconnect(t){if(t.dropboxToken)try{await fetch("https://api.dropboxapi.com/2/auth/token/revoke",{method:"POST",headers:{Authorization:`Bearer ${t.dropboxToken}`}})}catch(r){console.warn("[CloudSync] Dropbox revoke error:",r)}return{success:!0}},async upload(t,r){if(!r.dropboxToken)throw new Error("Not authenticated with Dropbox");const a=await this.getValidToken(r),e=await fetch("https://content.dropboxapi.com/2/files/upload",{method:"POST",headers:{Authorization:`Bearer ${a}`,"Dropbox-API-Arg":JSON.stringify({path:this.fileName,mode:"overwrite",autorename:!1,mute:!0}),"Content-Type":"application/octet-stream"},body:JSON.stringify(t)});if(e.status===401)throw new Error("Dropbox token expired. Please reconnect.");if(!e.ok){const s=await e.text();throw new Error(`Upload failed: ${s}`)}return{success:!0,timestamp:Date.now()}},async download(t){if(!t.dropboxToken)throw new Error("Not authenticated with Dropbox");const r=await fetch("https://content.dropboxapi.com/2/files/download",{method:"POST",headers:{Authorization:`Bearer ${t.dropboxToken}`,"Dropbox-API-Arg":JSON.stringify({path:this.fileName})}});if(r.status===409)return null;if(r.status===401)throw new Error("Dropbox token expired. Please reconnect.");if(!r.ok)throw new Error(`Download failed: ${r.status}`);return await r.json()},async test(t){if(!t.dropboxToken)return{success:!1,error:"Not authenticated"};try{const r=await fetch("https://api.dropboxapi.com/2/users/get_current_account",{method:"POST",headers:{Authorization:`Bearer ${t.dropboxToken}`}});return r.status===401?{success:!1,error:"Token expired"}:{success:r.ok}}catch(r){return{success:!1,error:r.message}}},async getStatus(t){if(t||(t=await H.get()),!t.dropboxToken)return{connected:!1};try{const r=await fetch("https://api.dropboxapi.com/2/users/get_current_account",{method:"POST",headers:{Authorization:`Bearer ${t.dropboxToken}`}});if(!r.ok)return{connected:!1};const a=await r.json();return{connected:!0,user:{email:a.email,name:a.name?.display_name||a.display_name||""}}}catch{return{connected:!1}}}},onedrive:{name:"OneDrive",icon:"\u{1F4C1}",requiresOAuth:!0,fileName:"scriptvault-backup.json",async connect(t){const r=t.onedriveClientId;if(!r)throw new Error("OneDrive Client ID required. Create one at https://portal.azure.com \u2192 App registrations");const a=chrome.identity.getRedirectURL("onedrive"),e="Files.ReadWrite.AppFolder User.Read offline_access",s=Array.from(crypto.getRandomValues(new Uint8Array(32)),Q=>Q.toString(16).padStart(2,"0")).join(""),o=new TextEncoder,c=await crypto.subtle.digest("SHA-256",o.encode(s)),u=btoa(String.fromCharCode(...new Uint8Array(c))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""),d=crypto.randomUUID(),f="https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?"+new URLSearchParams({client_id:r,redirect_uri:a,response_type:"code",scope:e,code_challenge:u,code_challenge_method:"S256",state:d}).toString(),h=await chrome.identity.launchWebAuthFlow({url:f,interactive:!0}),y=new URL(h);if(y.searchParams.get("state")!==d)throw new Error("CSRF state mismatch");const x=y.searchParams.get("code");if(!x)throw new Error("No authorization code received");const E=await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:r,code:x,code_verifier:s,grant_type:"authorization_code",redirect_uri:a,scope:e})});if(!E.ok)throw new Error("Token exchange failed: "+await E.text());const P=await E.json(),A=await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${P.access_token}`}}),X=A.ok?await A.json():{};return await H.set({onedriveToken:P.access_token,onedriveRefreshToken:P.refresh_token||"",onedriveConnected:!0,onedriveUser:{email:X.mail||X.userPrincipalName||"",name:X.displayName||""}}),{success:!0,user:{email:X.mail||X.userPrincipalName,name:X.displayName}}},async refreshToken(){const t=await H.get(),r=t.onedriveRefreshToken,a=t.onedriveClientId;if(!r||!a)return null;const e=await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:a,grant_type:"refresh_token",refresh_token:r,scope:"Files.ReadWrite.AppFolder User.Read offline_access"})});if(!e.ok)return console.warn("[CloudSync] OneDrive token refresh failed:",e.status),(e.status===400||e.status===401)&&await H.set({onedriveToken:"",onedriveRefreshToken:""}),null;const s=await e.json();return s.access_token?(await H.set({onedriveToken:s.access_token,onedriveRefreshToken:s.refresh_token||r}),s.access_token):null},async getValidToken(){let r=(await H.get()).onedriveToken;return r?(await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${r}`}})).ok?r:await this.refreshToken():null},async disconnect(){return await H.set({onedriveToken:"",onedriveRefreshToken:"",onedriveConnected:!1,onedriveUser:null}),{success:!0}},async upload(t){const r=await this.getValidToken();if(!r)throw new Error("Not authenticated with OneDrive");if(!t||typeof t!="object")throw new Error("Invalid backup data");const a=await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,{method:"PUT",headers:{Authorization:`Bearer ${r}`,"Content-Type":"application/json"},body:JSON.stringify(t)});if(!a.ok)throw new Error("Upload failed: "+await a.text());return{success:!0,timestamp:Date.now()}},async download(){const t=await this.getValidToken();if(!t)throw new Error("Not authenticated with OneDrive");const r=await fetch(`https://graph.microsoft.com/v1.0/me/drive/special/approot:/${this.fileName}:/content`,{headers:{Authorization:`Bearer ${t}`}});if(r.status===404)return null;if(!r.ok)throw new Error("Download failed: "+r.status);return await r.json()},async test(){try{const t=await this.getValidToken();return t?{success:(await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${t}`}})).ok}:{success:!1,error:"Not authenticated"}}catch(t){return{success:!1,error:t.message}}},async getStatus(t){try{if(t||(t=await H.get()),!t.onedriveConnected||!t.onedriveToken)return{connected:!1};const r=await this.getValidToken();if(!r)return{connected:!1};const a=await fetch("https://graph.microsoft.com/v1.0/me",{headers:{Authorization:`Bearer ${r}`}});if(!a.ok)return{connected:!1};const e=await a.json();return{connected:!0,user:{email:e.mail||e.userPrincipalName,name:e.displayName}}}catch{return{connected:!1}}}}};typeof self<"u"&&(self.CloudSyncProviders=mt);var Rr=(function(){"use strict";let t="en";const r={en:{appName:"ScriptVault",enabled:"Enabled",disabled:"Disabled",save:"Save",cancel:"Cancel",delete:"Delete",edit:"Edit",close:"Close",confirm:"Confirm",yes:"Yes",no:"No",ok:"OK",error:"Error",success:"Success",warning:"Warning",loading:"Loading...",search:"Search",refresh:"Refresh",tabScripts:"Installed Userscripts",tabSettings:"Settings",tabUtilities:"Utilities",tabHelp:"Help",tabValues:"Values Editor",newScript:"New Script",importScript:"Import",checkUpdates:"Check Updates",searchScripts:"Search scripts...",noScripts:"No userscripts installed",noScriptsDesc:"Create a new script or import one to get started.",scriptName:"Name",scriptVersion:"Version",scriptAuthor:"Author",scriptDescription:"Description",scriptSize:"Size",scriptUpdated:"Updated",scriptEnabled:"Script Enabled",scriptDisabled:"Script Disabled",editorCode:"Code",editorInfo:"Info",editorStorage:"Storage",editorSettings:"Settings",editorSave:"Save",editorClose:"Close",editorToggle:"Toggle",editorDuplicate:"Duplicate",editorDelete:"Delete",settingsGeneral:"General",settingsNotifications:"Notifications",settingsEditor:"Editor",settingsUpdates:"Updates",settingsSync:"Cloud Sync",settingsAdvanced:"Advanced",syncProvider:"Sync Provider",syncProviderNone:"Disabled",syncProviderWebdav:"WebDAV",syncProviderGoogleDrive:"Google Drive",syncProviderDropbox:"Dropbox",syncConnected:"Connected",syncDisconnected:"Not connected",syncConnect:"Connect",syncDisconnect:"Disconnect",syncNow:"Sync Now",syncTest:"Test",lastSync:"Last sync",syncSuccess:"Sync completed successfully",syncError:"Sync failed",valuesTitle:"Script Values Editor",valuesDesc:"View and edit GM_getValue/GM_setValue storage",valuesAllScripts:"All Scripts",valuesNoData:"No stored values found",valuesKey:"Key",valuesValue:"Value",valuesType:"Type",valuesScript:"Script",valuesAdd:"Add Value",valuesEdit:"Edit Value",valuesDelete:"Delete",valuesDeleteSelected:"Delete Selected",valuesSaved:"Value saved",valuesDeleted:"Value deleted",scriptSettingsTitle:"Per-Script Settings",scriptAutoUpdate:"Auto-update this script",scriptNotifyUpdates:"Notify on updates",scriptNotifyErrors:"Notify on errors",scriptRunAt:"Run at",scriptInjectInto:"Inject into",scriptExcludes:"Additional excludes",runAtDefault:"Default (from metadata)",runAtDocumentStart:"Document Start",runAtDocumentEnd:"Document End",runAtDocumentIdle:"Document Idle",injectAuto:"Auto",injectPage:"Page Context",injectContent:"Content Script",exportAll:"Export All",exportZip:"Export as ZIP",importFile:"Import from File",importUrl:"Import from URL",importText:"Import from Text",chooseFile:"Choose File",noFileSelected:"No file selected",scriptInstalled:"Script installed",scriptUpdated:"Script updated",scriptDeleted:"Script deleted",settingsSaved:"Settings saved",confirmDelete:"Are you sure you want to delete this script?",confirmDeleteMultiple:"Delete {count} selected scripts?",updateAvailable:"Update available",noUpdates:"All scripts are up to date"},es:{appName:"ScriptVault",enabled:"Activado",disabled:"Desactivado",save:"Guardar",cancel:"Cancelar",delete:"Eliminar",edit:"Editar",close:"Cerrar",confirm:"Confirmar",yes:"S\xED",no:"No",ok:"OK",error:"Error",success:"\xC9xito",warning:"Advertencia",loading:"Cargando...",search:"Buscar",refresh:"Actualizar",tabScripts:"Scripts Instalados",tabSettings:"Configuraci\xF3n",tabUtilities:"Utilidades",tabHelp:"Ayuda",tabValues:"Editor de Valores",newScript:"Nuevo Script",importScript:"Importar",checkUpdates:"Buscar Actualizaciones",searchScripts:"Buscar scripts...",noScripts:"No hay scripts instalados",noScriptsDesc:"Crea un nuevo script o importa uno para comenzar.",syncProvider:"Proveedor de Sincronizaci\xF3n",syncProviderNone:"Desactivado",syncConnect:"Conectar",syncDisconnect:"Desconectar",syncNow:"Sincronizar Ahora",lastSync:"\xDAltima sincronizaci\xF3n",valuesTitle:"Editor de Valores",valuesAllScripts:"Todos los Scripts",valuesNoData:"No se encontraron valores almacenados"},fr:{appName:"ScriptVault",enabled:"Activ\xE9",disabled:"D\xE9sactiv\xE9",save:"Enregistrer",cancel:"Annuler",delete:"Supprimer",edit:"Modifier",close:"Fermer",confirm:"Confirmer",yes:"Oui",no:"Non",ok:"OK",error:"Erreur",success:"Succ\xE8s",warning:"Avertissement",loading:"Chargement...",search:"Rechercher",refresh:"Actualiser",tabScripts:"Scripts Install\xE9s",tabSettings:"Param\xE8tres",tabUtilities:"Utilitaires",tabHelp:"Aide",tabValues:"\xC9diteur de Valeurs",newScript:"Nouveau Script",importScript:"Importer",checkUpdates:"V\xE9rifier les Mises \xE0 Jour",searchScripts:"Rechercher des scripts...",noScripts:"Aucun script install\xE9",syncProvider:"Fournisseur de Synchronisation",syncProviderNone:"D\xE9sactiv\xE9",syncConnect:"Connecter",syncDisconnect:"D\xE9connecter",syncNow:"Synchroniser",lastSync:"Derni\xE8re synchronisation"},de:{appName:"ScriptVault",enabled:"Aktiviert",disabled:"Deaktiviert",save:"Speichern",cancel:"Abbrechen",delete:"L\xF6schen",edit:"Bearbeiten",close:"Schlie\xDFen",confirm:"Best\xE4tigen",yes:"Ja",no:"Nein",ok:"OK",error:"Fehler",success:"Erfolg",warning:"Warnung",loading:"Laden...",search:"Suchen",refresh:"Aktualisieren",tabScripts:"Installierte Scripts",tabSettings:"Einstellungen",tabUtilities:"Werkzeuge",tabHelp:"Hilfe",tabValues:"Werte-Editor",newScript:"Neues Script",importScript:"Importieren",checkUpdates:"Updates pr\xFCfen",searchScripts:"Scripts suchen...",noScripts:"Keine Scripts installiert",syncProvider:"Sync-Anbieter",syncProviderNone:"Deaktiviert",syncConnect:"Verbinden",syncDisconnect:"Trennen",syncNow:"Jetzt synchronisieren",lastSync:"Letzte Synchronisation"},zh:{appName:"ScriptVault",enabled:"\u5DF2\u542F\u7528",disabled:"\u5DF2\u7981\u7528",save:"\u4FDD\u5B58",cancel:"\u53D6\u6D88",delete:"\u5220\u9664",edit:"\u7F16\u8F91",close:"\u5173\u95ED",confirm:"\u786E\u8BA4",yes:"\u662F",no:"\u5426",ok:"\u786E\u5B9A",error:"\u9519\u8BEF",success:"\u6210\u529F",warning:"\u8B66\u544A",loading:"\u52A0\u8F7D\u4E2D...",search:"\u641C\u7D22",refresh:"\u5237\u65B0",tabScripts:"\u5DF2\u5B89\u88C5\u811A\u672C",tabSettings:"\u8BBE\u7F6E",tabUtilities:"\u5DE5\u5177",tabHelp:"\u5E2E\u52A9",tabValues:"\u503C\u7F16\u8F91\u5668",newScript:"\u65B0\u5EFA\u811A\u672C",importScript:"\u5BFC\u5165",checkUpdates:"\u68C0\u67E5\u66F4\u65B0",searchScripts:"\u641C\u7D22\u811A\u672C...",noScripts:"\u6CA1\u6709\u5B89\u88C5\u811A\u672C",syncProvider:"\u540C\u6B65\u670D\u52A1",syncProviderNone:"\u7981\u7528",syncConnect:"\u8FDE\u63A5",syncDisconnect:"\u65AD\u5F00",syncNow:"\u7ACB\u5373\u540C\u6B65",lastSync:"\u4E0A\u6B21\u540C\u6B65"},ja:{appName:"ScriptVault",enabled:"\u6709\u52B9",disabled:"\u7121\u52B9",save:"\u4FDD\u5B58",cancel:"\u30AD\u30E3\u30F3\u30BB\u30EB",delete:"\u524A\u9664",edit:"\u7DE8\u96C6",close:"\u9589\u3058\u308B",confirm:"\u78BA\u8A8D",yes:"\u306F\u3044",no:"\u3044\u3044\u3048",ok:"OK",error:"\u30A8\u30E9\u30FC",success:"\u6210\u529F",warning:"\u8B66\u544A",loading:"\u8AAD\u307F\u8FBC\u307F\u4E2D...",search:"\u691C\u7D22",refresh:"\u66F4\u65B0",tabScripts:"\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u6E08\u307F\u30B9\u30AF\u30EA\u30D7\u30C8",tabSettings:"\u8A2D\u5B9A",tabUtilities:"\u30E6\u30FC\u30C6\u30A3\u30EA\u30C6\u30A3",tabHelp:"\u30D8\u30EB\u30D7",tabValues:"\u5024\u30A8\u30C7\u30A3\u30BF",newScript:"\u65B0\u898F\u30B9\u30AF\u30EA\u30D7\u30C8",importScript:"\u30A4\u30F3\u30DD\u30FC\u30C8",checkUpdates:"\u66F4\u65B0\u3092\u78BA\u8A8D",searchScripts:"\u30B9\u30AF\u30EA\u30D7\u30C8\u3092\u691C\u7D22...",noScripts:"\u30B9\u30AF\u30EA\u30D7\u30C8\u304C\u30A4\u30F3\u30B9\u30C8\u30FC\u30EB\u3055\u308C\u3066\u3044\u307E\u305B\u3093",syncProvider:"\u540C\u671F\u30D7\u30ED\u30D0\u30A4\u30C0\u30FC",syncProviderNone:"\u7121\u52B9",syncConnect:"\u63A5\u7D9A",syncDisconnect:"\u5207\u65AD",syncNow:"\u4ECA\u3059\u3050\u540C\u671F",lastSync:"\u6700\u7D42\u540C\u671F"},pt:{appName:"ScriptVault",enabled:"Ativado",disabled:"Desativado",save:"Salvar",cancel:"Cancelar",delete:"Excluir",edit:"Editar",close:"Fechar",confirm:"Confirmar",yes:"Sim",no:"N\xE3o",ok:"OK",error:"Erro",success:"Sucesso",warning:"Aviso",loading:"Carregando...",search:"Pesquisar",refresh:"Atualizar",tabScripts:"Scripts Instalados",tabSettings:"Configura\xE7\xF5es",tabUtilities:"Utilit\xE1rios",tabHelp:"Ajuda",tabValues:"Editor de Valores",newScript:"Novo Script",importScript:"Importar",checkUpdates:"Verificar Atualiza\xE7\xF5es",searchScripts:"Pesquisar scripts...",noScripts:"Nenhum script instalado",syncProvider:"Provedor de Sincroniza\xE7\xE3o",syncProviderNone:"Desativado",syncConnect:"Conectar",syncDisconnect:"Desconectar",syncNow:"Sincronizar Agora",lastSync:"\xDAltima sincroniza\xE7\xE3o"},ru:{appName:"ScriptVault",enabled:"\u0412\u043A\u043B\u044E\u0447\u0435\u043D\u043E",disabled:"\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",save:"\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",cancel:"\u041E\u0442\u043C\u0435\u043D\u0430",delete:"\u0423\u0434\u0430\u043B\u0438\u0442\u044C",edit:"\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C",close:"\u0417\u0430\u043A\u0440\u044B\u0442\u044C",confirm:"\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C",yes:"\u0414\u0430",no:"\u041D\u0435\u0442",ok:"OK",error:"\u041E\u0448\u0438\u0431\u043A\u0430",success:"\u0423\u0441\u043F\u0435\u0448\u043D\u043E",warning:"\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0435\u043D\u0438\u0435",loading:"\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...",search:"\u041F\u043E\u0438\u0441\u043A",refresh:"\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",tabScripts:"\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0435 \u0441\u043A\u0440\u0438\u043F\u0442\u044B",tabSettings:"\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",tabUtilities:"\u0423\u0442\u0438\u043B\u0438\u0442\u044B",tabHelp:"\u041F\u043E\u043C\u043E\u0449\u044C",tabValues:"\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0439",newScript:"\u041D\u043E\u0432\u044B\u0439 \u0441\u043A\u0440\u0438\u043F\u0442",importScript:"\u0418\u043C\u043F\u043E\u0440\u0442",checkUpdates:"\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F",searchScripts:"\u041F\u043E\u0438\u0441\u043A \u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432...",noScripts:"\u041D\u0435\u0442 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043A\u0440\u0438\u043F\u0442\u043E\u0432",syncProvider:"\u041F\u0440\u043E\u0432\u0430\u0439\u0434\u0435\u0440 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438",syncProviderNone:"\u041E\u0442\u043A\u043B\u044E\u0447\u0435\u043D\u043E",syncConnect:"\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C",syncDisconnect:"\u041E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C",syncNow:"\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u0442\u044C",lastSync:"\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u044F\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F"}};function a(){const o=(navigator.language||navigator.userLanguage||"en").split("-")[0].toLowerCase();return r[o]?o:"en"}function e(s,o={}){let u=(r[t]||r.en)[s]||r.en[s]||s;return Object.keys(o).forEach(d=>{const f=d.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");u=u.replace(new RegExp(`\\{${f}\\}`,"g"),o[d])}),u}return{init(s){return t=s==="auto"?a():r[s]?s:"en",console.log("[I18n] Initialized with locale:",t),t},setLocale(s){return r[s]?(t=s,!0):!1},getLocale(){return t},getMessage:e,t:e,getAvailableLocales(){return Object.keys(r).map(s=>({code:s,name:{en:"English",es:"Espa\xF1ol",fr:"Fran\xE7ais",de:"Deutsch",zh:"\u4E2D\u6587",ja:"\u65E5\u672C\u8A9E",pt:"Portugu\xEAs",ru:"\u0420\u0443\u0441\u0441\u043A\u0438\u0439"}[s]||s}))},applyToDOM(s=document){s.querySelectorAll("[data-i18n]").forEach(o=>{const c=o.getAttribute("data-i18n");o.textContent=e(c)}),s.querySelectorAll("[data-i18n-placeholder]").forEach(o=>{const c=o.getAttribute("data-i18n-placeholder");o.placeholder=e(c)}),s.querySelectorAll("[data-i18n-title]").forEach(o=>{const c=o.getAttribute("data-i18n-title");o.title=e(c)})}}})();typeof window<"u"&&(window.I18n=Rr);typeof self<"u"&&(self.I18n=Rr);function Qt(){return typeof structuredClone=="function"?structuredClone(Jr):JSON.parse(JSON.stringify(Jr))}const H={defaults:Qt(),cache:null,async init(){if(this.cache!==null)return;const t=await chrome.storage.local.get("settings");this.cache={...Qt(),...t.settings},console.log("[ScriptVault] Settings loaded")},async get(t){return await this.init(),t?this.cache[t]:{...this.cache}},async set(t,r){return await this.init(),typeof t=="object"?this.cache={...this.cache,...t}:this.cache[t]=r,await chrome.storage.local.set({settings:this.cache}),this.cache},async reset(){return this.defaults=Qt(),this.cache=Qt(),await chrome.storage.local.set({settings:this.cache}),this.cache}},O={cache:null,async init(){if(this.cache!==null)return;const t=await chrome.storage.local.get("userscripts");this.cache=t.userscripts||{},console.log("[ScriptVault] Loaded",Object.keys(this.cache).length,"scripts")},async save(){await chrome.storage.local.set({userscripts:this.cache})},async getAll(){return await this.init(),Object.values(this.cache)},async get(t){return await this.init(),this.cache[t]||null},async set(t,r){await this.init();const a=this.cache[t];this.cache[t]=r;try{await this.save()}catch(e){throw a!==void 0?this.cache[t]=a:delete this.cache[t],e}return r},async delete(t){await this.init();const r=this.cache[t];delete this.cache[t];try{await Me.deleteAll(t),await this.save()}catch(a){throw r!==void 0&&(this.cache[t]=r),a}},async clear(){this.cache={},await this.save()},async search(t){await this.init();const r=t.toLowerCase();return Object.values(this.cache).filter(a=>(a.meta?.name||"").toLowerCase().includes(r)||(a.meta?.description||"").toLowerCase().includes(r)||(a.meta?.author||"").toLowerCase().includes(r))},async getByNamespace(t){return await this.init(),Object.values(this.cache).filter(r=>r.meta?.namespace===t)},async reorder(t){await this.init(),t.forEach((r,a)=>{this.cache[r]&&(this.cache[r].position=a)}),await this.save()},async duplicate(t){await this.init();const r=this.cache[t];if(!r)return null;const a=st(),e={...JSON.parse(JSON.stringify(r)),id:a,meta:{...r.meta,name:(r.meta?.name||"Unnamed")+" (Copy)"},createdAt:Date.now(),updatedAt:Date.now()};return this.cache[a]=e,await this.save(),e}},Me={cache:{},listeners:new Map,pendingNotifications:new Map,async init(t){if(this.cache[t])return;const r=await chrome.storage.local.get(`values_${t}`);this.cache[t]=r[`values_${t}`]||{}},async get(t,r,a){await this.init(t);const e=this.cache[t][r];return e!==void 0?e:a},async set(t,r,a){await this.init(t);const e=this.cache[t][r];return this.cache[t][r]=a,await chrome.storage.local.set({[`values_${t}`]:this.cache[t]}),this.scheduleNotification(t,r,e,a),a},scheduleNotification(t,r,a,e){const s=`${t}_${r}`,o=this.pendingNotifications.get(s);o&&(clearTimeout(o.timeout),a=o.oldValue);const c=setTimeout(()=>{this.pendingNotifications.delete(s),this.notifyChange(t,r,a,e,!1)},100);this.pendingNotifications.set(s,{timeout:c,oldValue:a})},async delete(t,r){await this.init(t);const a=this.cache[t][r];delete this.cache[t][r],await chrome.storage.local.set({[`values_${t}`]:this.cache[t]}),this.scheduleNotification(t,r,a,void 0)},async list(t){return await this.init(t),Object.keys(this.cache[t])},async getAll(t){return await this.init(t),{...this.cache[t]}},async setAll(t,r){await this.init(t);for(const[a,e]of Object.entries(r)){const s=this.cache[t][a];this.cache[t][a]=e,this.scheduleNotification(t,a,s,e)}await chrome.storage.local.set({[`values_${t}`]:this.cache[t]})},async deleteAll(t){delete this.cache[t],await chrome.storage.local.remove(`values_${t}`)},async deleteMultiple(t,r){await this.init(t);for(const a of r){const e=this.cache[t][a];delete this.cache[t][a],this.scheduleNotification(t,a,e,void 0)}await chrome.storage.local.set({[`values_${t}`]:this.cache[t]})},async getStorageSize(t){return await this.init(t),JSON.stringify(this.cache[t]||{}).length},addListener(t,r,a){const e=`${t}_${r}`;return this.listeners.set(e,{scriptId:t,callback:a}),e},removeListener(t){this.listeners.delete(t)},notifyChange(t,r,a,e,s){a!==e&&(this.listeners.forEach(o=>{if(o.scriptId===t)try{o.callback(r,a,e,s)}catch(c){console.error("[ScriptVault] Value change listener error:",c)}}),chrome.tabs.query({status:"complete"}).then(o=>{const c={action:"valueChanged",data:{scriptId:t,key:r,oldValue:a,newValue:e,remote:!0}};for(const u of o)chrome.tabs.sendMessage(u.id,c).catch(()=>{})}).catch(()=>{}))}},or={data:new Map,get(t){return this.data.get(t)||{}},set(t,r){this.data.set(t,r)},delete(t){this.data.delete(t)},getAll(){const t={};return this.data.forEach((r,a)=>{t[a]=r}),t}};self._notifCallbacks||(self._notifCallbacks=new Map);chrome.tabs.onRemoved.addListener(t=>{or.delete(t),kt.abortByTab(t);for(const[r,a]of self._notifCallbacks)a.tabId===t&&self._notifCallbacks.delete(r)});chrome.notifications.onClicked.addListener(t=>{if(!self._notifCallbacks)return;const r=self._notifCallbacks.get(t);r&&r.hasOnclick&&chrome.tabs.sendMessage(r.tabId,{action:"notificationEvent",data:{notifId:t,scriptId:r.scriptId,type:"click"}}).catch(()=>{})});chrome.notifications.onClosed.addListener((t,r)=>{if(!self._notifCallbacks)return;const a=self._notifCallbacks.get(t);a&&(a.hasOndone&&chrome.tabs.sendMessage(a.tabId,{action:"notificationEvent",data:{notifId:t,scriptId:a.scriptId,type:"done"}}).catch(()=>{}),self._notifCallbacks.delete(t))});const xt={cache:null,async init(){if(this.cache!==null)return;const t=await chrome.storage.local.get("scriptFolders");this.cache=t.scriptFolders||[]},async save(){await chrome.storage.local.set({scriptFolders:this.cache})},async getAll(){return await this.init(),this.cache},async create(t,r="#60a5fa"){await this.init();const a={id:st(),name:t,color:r,collapsed:!1,scriptIds:[],createdAt:Date.now()};return this.cache.push(a),await this.save(),a},async update(t,r){await this.init();const a=this.cache.find(e=>e.id===t);return a&&(Object.assign(a,r),await this.save()),a},async delete(t){await this.init(),this.cache=this.cache.filter(r=>r.id!==t),await this.save()},async addScript(t,r){await this.init();const a=this.cache.find(e=>e.id===t);if(a&&!a.scriptIds.includes(r)){a.scriptIds.push(r);try{await this.save()}catch(e){throw a.scriptIds.pop(),e}}},async removeScript(t,r){await this.init();const a=this.cache.find(e=>e.id===t);if(a){const e=a.scriptIds;a.scriptIds=e.filter(s=>s!==r);try{await this.save()}catch(s){throw a.scriptIds=e,s}}},async moveScript(t,r,a){if(await this.init(),r){const e=this.cache.find(s=>s.id===r);e&&(e.scriptIds=e.scriptIds.filter(s=>s!==t))}if(a){const e=this.cache.find(s=>s.id===a);e&&!e.scriptIds.includes(t)&&e.scriptIds.push(t)}await this.save()},getFolderForScript(t){return this.cache&&this.cache.find(r=>r.scriptIds.includes(t))||null}},Yr=new Map;chrome.tabs.onRemoved.addListener(t=>{const r=Yr.get(t);r&&(Yr.delete(t),chrome.tabs.sendMessage(r.callerTabId,{action:"openedTabClosed",data:{tabId:t,scriptId:r.scriptId}}).catch(()=>{}))});const kt={requests:new Map,nextId:1,create(t,r,a){const e=`xhr_${this.nextId++}_${Date.now()}`,s={id:e,controller:null,tabId:t,scriptId:r,details:a,aborted:!1,startTime:Date.now()};return this.requests.set(e,s),s._cleanupTimer=setTimeout(()=>this.remove(e),3e5),s},get(t){return this.requests.get(t)},abort(t){const r=this.requests.get(t);if(r&&!r.aborted){if(r.aborted=!0,r.controller)try{r.controller.abort()}catch{}return!0}return!1},remove(t){const r=this.requests.get(t);r?._cleanupTimer&&clearTimeout(r._cleanupTimer),this.requests.delete(t)},abortByTab(t){for(const[r,a]of this.requests)a.tabId===t&&(this.abort(r),this.remove(r))},abortByScript(t){for(const[r,a]of this.requests)a.scriptId===t&&(this.abort(r),this.remove(r))},getActiveCount(){return this.requests.size}},Vt={cache:{},maxAge:864e5,STORAGE_PREFIX:"res_cache_",async get(t){const r=this.cache[t];if(r&&Date.now()-r.timestamp<this.maxAge)return r;r&&delete this.cache[t];try{const a=this.STORAGE_PREFIX+t,e=await chrome.storage.local.get(a);if(e[a]&&Date.now()-e[a].timestamp<this.maxAge)return this.cache[t]=e[a],e[a];e[a]&&chrome.storage.local.remove(a).catch(()=>{})}catch{}return null},async set(t,r,a){const e={text:r,dataUri:a,timestamp:Date.now()};this.cache[t]=e;try{const s=this.STORAGE_PREFIX+t;await chrome.storage.local.set({[s]:e})}catch{}},async fetchResource(t){const r=await this.get(t);if(r)return r.text;if(t&&!t.startsWith("https://")&&!t.startsWith("http://"))throw new Error("Only HTTP(S) URLs allowed for @resource/@require");try{const a=new AbortController,e=setTimeout(()=>a.abort(),3e4),s=await fetch(t,{signal:a.signal});if(clearTimeout(e),!s.ok)throw new Error(`HTTP ${s.status}`);const o=s.headers.get("content-type")||"text/plain",c=await s.arrayBuffer(),u=new Uint8Array(c);let d;o.includes("text")||o.includes("json")||o.includes("xml")||o.includes("css")||o.includes("javascript")?d=new TextDecoder().decode(u):d="";const f=[];for(let _=0;_<u.length;_+=8192)f.push(String.fromCharCode.apply(null,u.subarray(_,_+8192)));const h=btoa(f.join("")),y=`data:${o};base64,${h}`;return await this.set(t,d,y),d}catch(a){throw console.error("[ScriptVault] Failed to fetch resource:",t,a),a}},async getDataUri(t){const r=await this.get(t);if(r&&r.dataUri)return r.dataUri;await this.fetchResource(t);const a=await this.get(t);return a?a.dataUri:null},async prefetchResources(t){if(!t||typeof t!="object")return;const r=Object.values(t).map(a=>this.fetchResource(a).catch(e=>console.warn("[ScriptVault] Resource prefetch failed:",a,e.message)));await Promise.allSettled(r)},async clear(){this.cache={};try{const t=await chrome.storage.local.get(null),r=Object.keys(t).filter(a=>a.startsWith(this.STORAGE_PREFIX));r.length>0&&await chrome.storage.local.remove(r)}catch{}}},Zt={CACHE_KEY:"npmCache",CACHE_TTL:864e5,REGISTRY_URL:"https://registry.npmjs.org",REQUEST_TIMEOUT:1e4,POPULAR_PACKAGES:{lodash:{cdn:"lodash",file:"lodash.min.js"},jquery:{cdn:"jquery",file:"jquery.min.js"},axios:{cdn:"axios",file:"axios.min.js"},moment:{cdn:"moment",file:"moment.min.js"},dayjs:{cdn:"dayjs",file:"dayjs.min.js"},rxjs:{cdn:"rxjs",file:"rxjs.umd.min.js"},underscore:{cdn:"underscore",file:"underscore-min.js"},ramda:{cdn:"ramda",file:"ramda.min.js"},dompurify:{cdn:"dompurify",file:"purify.min.js"},marked:{cdn:"marked",file:"marked.min.js"},"highlight.js":{cdn:"highlight.js",file:"highlight.min.js"},"chart.js":{cdn:"Chart.js",file:"chart.umd.js"},three:{cdn:"three",file:"three.min.js"},d3:{cdn:"d3",file:"d3.min.js"},gsap:{cdn:"gsap",file:"gsap.min.js"},animejs:{cdn:"animejs",file:"anime.min.js"},"anime.js":{cdn:"animejs",file:"anime.min.js"},sweetalert2:{cdn:"sweetalert2",file:"sweetalert2.all.min.js"},"tippy.js":{cdn:"tippy.js",file:"tippy-bundle.umd.min.js"},sortablejs:{cdn:"Sortable",file:"Sortable.min.js"},luxon:{cdn:"luxon",file:"luxon.min.js"}},isNpmRequire(t){return typeof t=="string"&&t.startsWith("npm:")},async resolve(t){if(!this.isNpmRequire(t))throw new Error(`Not an npm require: ${t}`);const{name:r,version:a}=this._parseSpec(t),e=`${r}@${a||"latest"}`,s=await this._getCache(e);if(s)return s;const o=a&&a!=="latest"?a:await this._resolveLatestVersion(r);if(!o)throw new Error(`Failed to resolve version for package: ${r}`);const c=this._buildCdnUrls(r,o);let u=null;for(const d of c)try{const f=await this._fetchWithTimeout(d),h=await this._computeSriHash(f),y={url:d,integrity:h,version:o};return await this._setCache(e,y),y}catch(f){u=f}throw new Error(`Failed to resolve npm:${r}@${o} from all CDNs: ${u?.message||"unknown error"}`)},async resolveAll(t){const r=new Map,a=t.map(async e=>{try{const s=await this.resolve(e);r.set(e,s)}catch(s){r.set(e,{error:s.message})}});return await Promise.allSettled(a),r},async getPackageInfo(t){const r=this._sanitizePackageName(t),a=`${this.REGISTRY_URL}/${encodeURIComponent(r).replace("%40","@")}/latest`,e=await this._fetchWithTimeout(a,{isJson:!0}),s=JSON.parse(e);return{name:s.name,version:s.version,description:s.description||"",homepage:s.homepage||"",main:s.main||"index.js"}},async clearCache(){try{await chrome.storage.local.remove(this.CACHE_KEY)}catch{}},_parseSpec(t){const r=t.slice(4);if(!r)throw new Error("Empty npm package spec");let a,e=null;if(r.startsWith("@")){const s=r.indexOf("/");if(s===-1)throw new Error(`Invalid scoped package: ${r}`);const o=r.indexOf("@",s);o>s?(a=r.slice(0,o),e=r.slice(o+1)):a=r}else{const s=r.indexOf("@");s>0?(a=r.slice(0,s),e=r.slice(s+1)):a=r}return a=this._sanitizePackageName(a),e&&(e=this._sanitizeVersion(e)),{name:a,version:e}},_sanitizePackageName(t){const r=t.trim();if(!/^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*$/.test(r))throw new Error(`Invalid package name: ${r}`);return r},_sanitizeVersion(t){const r=t.trim();if(!/^[a-z0-9\-._^~>=<| *]+$/i.test(r))throw new Error(`Invalid version: ${r}`);return r},async _resolveLatestVersion(t){try{return(await this.getPackageInfo(t)).version}catch{return null}},_buildCdnUrls(t,r){const a=this.POPULAR_PACKAGES[t],e=[];return a&&(e.push(`https://cdn.jsdelivr.net/npm/${t}@${r}/dist/${a.file}`),e.push(`https://unpkg.com/${t}@${r}/dist/${a.file}`),e.push(`https://cdnjs.cloudflare.com/ajax/libs/${a.cdn}/${r}/${a.file}`)),e.push(`https://cdn.jsdelivr.net/npm/${t}@${r}/+esm`),e.push(`https://unpkg.com/${t}@${r}`),e.push(`https://cdnjs.cloudflare.com/ajax/libs/${t}/${r}/${t}.min.js`),[...new Set(e)]},async _fetchWithTimeout(t,r={}){const a=new AbortController,e=setTimeout(()=>a.abort(),this.REQUEST_TIMEOUT);try{const s=await fetch(t,{signal:a.signal,headers:r.isJson?{Accept:"application/json"}:{}});if(!s.ok)throw new Error(`HTTP ${s.status} for ${t}`);return await s.text()}finally{clearTimeout(e)}},async _computeSriHash(t){const a=new TextEncoder().encode(t),e=await crypto.subtle.digest("SHA-256",a),s=new Uint8Array(e);let o="";for(let c=0;c<s.length;c++)o+=String.fromCharCode(s[c]);return`sha256-${btoa(o)}`},async _getCache(t){try{const a=(await chrome.storage.local.get(this.CACHE_KEY))[this.CACHE_KEY];if(!a||typeof a!="object")return null;const e=a[t];return e?Date.now()-e.timestamp>this.CACHE_TTL?(delete a[t],chrome.storage.local.set({[this.CACHE_KEY]:a}).catch(()=>{}),null):{url:e.url,integrity:e.integrity,version:e.version}:null}catch{return null}},async _setCache(t,r){try{const a=await chrome.storage.local.get(this.CACHE_KEY),e=a[this.CACHE_KEY]&&typeof a[this.CACHE_KEY]=="object"?a[this.CACHE_KEY]:{};e[t]={url:r.url,integrity:r.integrity,version:r.version,timestamp:Date.now()},await chrome.storage.local.set({[this.CACHE_KEY]:e})}catch{}}},Xe={STORAGE_KEY:"errorLog",MAX_ENTRIES:500,_cache:null,async log(t){const r=await this._load(),a={id:crypto.randomUUID(),timestamp:Date.now(),scriptId:t.scriptId||null,scriptName:t.scriptName||null,error:typeof t.error=="string"?t.error:t.error?.message||String(t.error),stack:t.stack||t.error?.stack||null,url:t.url||null,line:t.line??null,col:t.col??null,context:t.context||null};if(!a.scriptName&&a.scriptId)try{if(typeof O<"u"){const e=await O.get(a.scriptId);e?.meta?.name&&(a.scriptName=e.meta.name)}}catch{}return r.push(a),r.length>this.MAX_ENTRIES&&r.splice(0,r.length-this.MAX_ENTRIES),this._cache=r,await this._save(),a},async getAll(t){let r=await this._load();if(!t)return[...r];if(t.scriptId&&(r=r.filter(a=>a.scriptId===t.scriptId)),t.startDate){const a=typeof t.startDate=="number"?t.startDate:new Date(t.startDate).getTime();r=r.filter(e=>e.timestamp>=a)}if(t.endDate){const a=typeof t.endDate=="number"?t.endDate:new Date(t.endDate).getTime();r=r.filter(e=>e.timestamp<=a)}if(t.errorType){const a=t.errorType.toLowerCase();r=r.filter(e=>(e.error||"").toLowerCase().includes(a))}if(t.search){const a=t.search.toLowerCase();r=r.filter(e=>(e.error||"").toLowerCase().includes(a)||(e.scriptName||"").toLowerCase().includes(a)||(e.stack||"").toLowerCase().includes(a)||(e.url||"").toLowerCase().includes(a)||(e.context||"").toLowerCase().includes(a))}return r},async getGrouped(t){const r=await this.getAll(t),a=new Map;for(const e of r){const s=`${e.scriptId||""}::${e.error||""}`;if(a.has(s)){const o=a.get(s);o.count++,e.timestamp<o.firstSeen&&(o.firstSeen=e.timestamp),e.timestamp>o.lastSeen&&(o.lastSeen=e.timestamp),e.stack&&e.timestamp>=o.lastSeen&&(o.sampleStack=e.stack)}else a.set(s,{key:s,error:e.error,scriptId:e.scriptId,scriptName:e.scriptName,count:1,firstSeen:e.timestamp,lastSeen:e.timestamp,sampleStack:e.stack||null})}return[...a.values()].sort((e,s)=>s.lastSeen-e.lastSeen)},async exportJSON(t){const r=await this.getAll(t);return JSON.stringify({exported:new Date().toISOString(),count:r.length,entries:r},null,2)},async exportText(t){const r=await this.getAll(t),a=[`ScriptVault Error Log - Exported ${new Date().toISOString()}`,`Total entries: ${r.length}`,"=".repeat(80),""];for(const e of r){const s=new Date(e.timestamp).toISOString();if(a.push(`[${s}] ${e.scriptName||e.scriptId||"Unknown"}`),a.push(`  Error: ${e.error}`),e.url&&a.push(`  URL: ${e.url}${e.line!=null?`:${e.line}`:""}${e.col!=null?`:${e.col}`:""}`),e.context&&a.push(`  Context: ${e.context}`),e.stack){a.push("  Stack:");for(const o of e.stack.split(`
`).slice(0,5))a.push(`    ${o.trim()}`)}a.push("")}return a.join(`
`)},async exportCSV(t){const r=await this.getAll(t),a=["timestamp","datetime","scriptId","scriptName","error","url","line","col","context"],e=o=>{if(o==null)return"";const c=String(o);return c.includes(",")||c.includes('"')||c.includes(`
`)||c.includes("\r")?'"'+c.replace(/"/g,'""')+'"':c},s=[a.join(",")];for(const o of r)s.push([o.timestamp,new Date(o.timestamp).toISOString(),e(o.scriptId),e(o.scriptName),e(o.error),e(o.url),o.line??"",o.col??"",e(o.context)].join(","));return s.join(`
`)},async clear(t){if(t){const r=await this._load();this._cache=r.filter(a=>a.scriptId!==t),await this._save()}else this._cache=[],await this._save()},async getStats(){const t=await this._load(),r={};for(const e of t){const s=e.scriptId||"unknown";r[s]||(r[s]={scriptId:e.scriptId,scriptName:e.scriptName,count:0}),r[s].count++}const a=JSON.stringify(t).length;return{total:t.length,maxEntries:this.MAX_ENTRIES,byScript:Object.values(r).sort((e,s)=>s.count-e.count),oldest:t.length>0?t[0].timestamp:null,newest:t.length>0?t[t.length-1].timestamp:null,storageBytes:a}},registerGlobalHandlers(){self.addEventListener("error",t=>{this.log({scriptId:null,scriptName:"ServiceWorker",error:t.message||"Unknown error",stack:t.error?.stack||null,url:t.filename||null,line:t.lineno??null,col:t.colno??null,context:"global-error-handler"}).catch(()=>{})}),self.addEventListener("unhandledrejection",t=>{const r=t.reason;this.log({scriptId:null,scriptName:"ServiceWorker",error:r?.message||String(r),stack:r?.stack||null,context:"unhandled-rejection"}).catch(()=>{})}),console.log("[ScriptVault] Error log global handlers registered")},async logScriptError(t,r,a){return this.log({scriptId:t,scriptName:r,error:a.message||a.error||"Script execution error",stack:a.stack||null,url:a.url||null,line:a.line??a.lineno??null,col:a.col??a.colno??null,context:"script-execution"})},async logGMError(t,r,a,e){return this.log({scriptId:t,scriptName:r,error:`GM API ${a}: ${typeof e=="string"?e:e?.message||String(e)}`,stack:e?.stack||null,context:`gm-api-${a}`})},async _load(){if(this._cache)return this._cache;const t=await chrome.storage.local.get(this.STORAGE_KEY);return this._cache=t[this.STORAGE_KEY]||[],this._cache},async _save(){await chrome.storage.local.set({[this.STORAGE_KEY]:this._cache})}},At={ALARM_WEEKLY_DIGEST:"scriptvault-weekly-digest",STORAGE_KEY_PREFS:"notificationPrefs",STORAGE_KEY_DIGEST:"weeklyDigest",STORAGE_KEY_ERROR_COUNTS:"notifErrorCounts",STORAGE_KEY_RATE_LIMITS:"notifRateLimits",defaultPrefs:{updates:!0,errors:!0,digest:!1,security:!0,quietHoursEnabled:!1,quietHoursStart:22,quietHoursEnd:7},_prefsCache:null,_errorCounts:null,_rateLimits:null,async getPreferences(){if(this._prefsCache)return{...this._prefsCache};const t=await chrome.storage.local.get(this.STORAGE_KEY_PREFS);return this._prefsCache={...this.defaultPrefs,...t[this.STORAGE_KEY_PREFS]},{...this._prefsCache}},async setPreferences(t){const r=await this.getPreferences();return this._prefsCache={...r,...t},await chrome.storage.local.set({[this.STORAGE_KEY_PREFS]:this._prefsCache}),"digest"in t&&(t.digest?await this.scheduleDigest():await chrome.alarms.clear(this.ALARM_WEEKLY_DIGEST)),{...this._prefsCache}},async _isQuietHours(){const t=await this.getPreferences();if(!t.quietHoursEnabled)return!1;const a=new Date().getHours(),{quietHoursStart:e,quietHoursEnd:s}=t;return e>s?a>=e||a<s:a>=e&&a<s},async notifyUpdate(t){if(!(await this.getPreferences()).updates||await this._isQuietHours())return;const a=Array.isArray(t)?t:[t];if(a.length===0)return;await this._addDigestData("updatedScripts",a.map(c=>({id:c.id,name:c.name,version:c.version,oldVersion:c.oldVersion||null,timestamp:Date.now()})));let e,s,o;if(a.length===1){const c=a[0];e="Script Updated",s=`${c.name} updated to v${c.version}`,o=`update-${c.id}-${Date.now()}`}else e=`${a.length} Scripts Updated`,s=a.map(c=>c.name).join(", "),o=`update-batch-${Date.now()}`;try{await chrome.notifications.create(o,{type:"basic",iconUrl:chrome.runtime.getURL("images/icon128.png"),title:e,message:s,priority:0})}catch(c){console.error("[ScriptVault] Failed to create update notification:",c)}await this._setClickContext(o,{action:"openScript",scriptId:a.length===1?a[0].id:null})},async notifyError(t,r){if(!(await this.getPreferences()).errors)return;if(!this._errorCounts){const f=await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);this._errorCounts=f[this.STORAGE_KEY_ERROR_COUNTS]||{}}if(!this._rateLimits){const f=await chrome.storage.local.get(this.STORAGE_KEY_RATE_LIMITS);this._rateLimits=f[this.STORAGE_KEY_RATE_LIMITS]||{}}if(this._errorCounts[t]=(this._errorCounts[t]||0)+1,await chrome.storage.local.set({[this.STORAGE_KEY_ERROR_COUNTS]:this._errorCounts}),await this._addDigestData("errors",[{scriptId:t,message:typeof r=="string"?r:r?.message||"Unknown error",timestamp:Date.now()}]),this._errorCounts[t]<3)return;const e=this._rateLimits[t]||0;if(Date.now()-e<36e5||await this._isQuietHours())return;const o=typeof r=="string"?r:r?.message||"Unknown error",c=o.length>120?o.substring(0,117)+"...":o;let u=t;try{if(typeof O<"u"){const f=await O.get(t);f?.meta?.name&&(u=f.meta.name)}}catch{}const d=`error-${t}-${Date.now()}`;try{await chrome.notifications.create(d,{type:"basic",iconUrl:chrome.runtime.getURL("images/icon128.png"),title:`Script Error: ${u}`,message:`${this._errorCounts[t]} consecutive errors
${c}`,priority:1})}catch(f){console.error("[ScriptVault] Failed to create error notification:",f)}this._errorCounts[t]=0,this._rateLimits[t]=Date.now(),await chrome.storage.local.set({[this.STORAGE_KEY_ERROR_COUNTS]:this._errorCounts,[this.STORAGE_KEY_RATE_LIMITS]:this._rateLimits}),await this._setClickContext(d,{action:"openScript",scriptId:t})},async resetErrorCount(t){if(!this._errorCounts){const r=await chrome.storage.local.get(this.STORAGE_KEY_ERROR_COUNTS);this._errorCounts=r[this.STORAGE_KEY_ERROR_COUNTS]||{}}this._errorCounts[t]&&(delete this._errorCounts[t],await chrome.storage.local.set({[this.STORAGE_KEY_ERROR_COUNTS]:this._errorCounts}))},async notifyBlacklist(t,r){if(!(await this.getPreferences()).security)return;let e=t;try{if(typeof O<"u"){const o=await O.get(t);o?.meta?.name&&(e=o.meta.name)}}catch{}const s=`blacklist-${t}-${Date.now()}`;try{await chrome.notifications.create(s,{type:"basic",iconUrl:chrome.runtime.getURL("images/icon128.png"),title:"Security Warning",message:`${e}: ${r}`,priority:2,requireInteraction:!0})}catch(o){console.error("[ScriptVault] Failed to create blacklist notification:",o)}await this._addDigestData("securityAlerts",[{scriptId:t,scriptName:e,reason:r,timestamp:Date.now()}]),await this._setClickContext(s,{action:"openScript",scriptId:t})},async scheduleDigest(){if(!(await this.getPreferences()).digest)return;await chrome.alarms.clear(this.ALARM_WEEKLY_DIGEST).catch(()=>{});const r=10080*60*1e3;await chrome.alarms.create(this.ALARM_WEEKLY_DIGEST,{delayInMinutes:r/6e4,periodInMinutes:r/6e4}),console.log("[ScriptVault] Weekly digest alarm scheduled")},async generateDigest(){const r=(await chrome.storage.local.get(this.STORAGE_KEY_DIGEST))[this.STORAGE_KEY_DIGEST]||this._emptyDigest();let a=null;try{const u=await navigator.storage?.estimate?.();u&&(a={used:u.usage||0,quota:u.quota||0})}catch{}let e=[];try{if(typeof O<"u"){const u=await O.getAll(),d=2160*60*60*1e3,f=Date.now();e=u.filter(h=>h.updatedAt&&f-h.updatedAt>d).map(h=>({id:h.id,name:h.meta?.name||"Unknown",lastUpdated:h.updatedAt}))}}catch{}const s={period:{start:r.periodStart||Date.now()-10080*60*1e3,end:Date.now()},updatedScripts:r.updatedScripts||[],totalErrors:(r.errors||[]).length,uniqueErrorScripts:[...new Set((r.errors||[]).map(u=>u.scriptId))].length,securityAlerts:r.securityAlerts||[],storageUsage:a,staleScripts:e,generatedAt:Date.now()},o=[];if(s.updatedScripts.length>0&&o.push(`${s.updatedScripts.length} script(s) updated`),s.totalErrors>0&&o.push(`${s.totalErrors} error(s) from ${s.uniqueErrorScripts} script(s)`),s.securityAlerts.length>0&&o.push(`${s.securityAlerts.length} security alert(s)`),s.staleScripts.length>0&&o.push(`${s.staleScripts.length} stale script(s) (90+ days)`),a){const u=(a.used/a.quota*100).toFixed(1);o.push(`Storage: ${u}% used`)}o.length===0&&o.push("No activity this week");const c=`digest-${Date.now()}`;try{await chrome.notifications.create(c,{type:"basic",iconUrl:chrome.runtime.getURL("images/icon128.png"),title:"ScriptVault Weekly Digest",message:o.join(`
`),priority:0})}catch(u){console.error("[ScriptVault] Failed to create digest notification:",u)}return s.message=o.join(`
`),await chrome.storage.local.set({[this.STORAGE_KEY_DIGEST]:{...this._emptyDigest(),lastSummary:s}}),await this._setClickContext(c,{action:"openDashboard"}),s},async handleClick(t){const r=`notifCtx_${t}`,e=(await chrome.storage.local.get(r))[r];if(await chrome.storage.local.remove(r),chrome.notifications.clear(t),!e)return;const s=chrome.runtime.getURL("pages/dashboard.html");if(e.action==="openScript"&&e.scriptId)try{await chrome.tabs.create({url:`${s}#script=${e.scriptId}`})}catch{await chrome.tabs.create({url:s})}else e.action==="openDashboard"&&await chrome.tabs.create({url:s})},_emptyDigest(){return{periodStart:Date.now(),updatedScripts:[],errors:[],securityAlerts:[],lastSummary:null}},async _addDigestData(t,r){const e=(await chrome.storage.local.get(this.STORAGE_KEY_DIGEST))[this.STORAGE_KEY_DIGEST]||this._emptyDigest();e[t]||(e[t]=[]),e[t].push(...r);const s=200;e[t].length>s&&(e[t]=e[t].slice(-s)),await chrome.storage.local.set({[this.STORAGE_KEY_DIGEST]:e})},async _setClickContext(t,r){const a=`notifCtx_${t}`;await chrome.storage.local.set({[a]:r});try{chrome.alarms.create(`notifCtx_clean_${t}`,{delayInMinutes:5})}catch{}},async handleAlarm(t){if(t.name===this.ALARM_WEEKLY_DIGEST)return await this.generateDigest(),!0;if(t.name.startsWith("notifCtx_clean_")){const a=`notifCtx_${t.name.replace("notifCtx_clean_","")}`;return await chrome.storage.local.remove(a).catch(()=>{}),!0}return!1},async init(){(await this.getPreferences()).digest&&await this.scheduleDigest(),console.log("[ScriptVault] Notification system initialized")}};var et=(()=>{"use strict";const t="[EasyCloud]",r="easycloud-periodic-sync",s="https://www.googleapis.com/drive/v3",o="https://www.googleapis.com/upload/drive/v3",c="scriptvault-sync.json",u="easycloud_",d={CONNECTED:u+"connected",DEVICE_ID:u+"deviceId",LAST_SYNC:u+"lastSync",STATUS:u+"status",OFFLINE_QUEUE:u+"offlineQueue",USER_EMAIL:u+"userEmail",USER_NAME:u+"userName",FILE_ID:u+"fileId"},f={IDLE:"synced",SYNCING:"syncing",ERROR:"error",OFFLINE:"offline"};let h=f.IDLE,y=!1,_=null,x=[],E=null,P=null,A=null,X=!1;function Q(...b){console.log(t,...b)}function ae(...b){console.warn(t,...b)}function z(b){if(h!==b){h=b,V(b);for(const L of x)try{L(b)}catch(F){ae("Status listener error:",F)}}}async function V(b){try{await chrome.storage.local.set({[d.STATUS]:b})}catch{}}async function C(b){return chrome.storage.local.get(b)}async function W(b){return chrome.storage.local.set(b)}async function Y(){if(A)return A;const b=await C([d.DEVICE_ID]);if(b[d.DEVICE_ID])return A=b[d.DEVICE_ID],A;const L=crypto.getRandomValues(new Uint8Array(16));return A=Array.from(L,F=>F.toString(16).padStart(2,"0")).join(""),await W({[d.DEVICE_ID]:A}),A}function N(){return typeof navigator<"u"?navigator.onLine:!0}async function B(b=!1){if(!chrome.identity||!chrome.identity.getAuthToken)throw new Error('chrome.identity API not available. Grant the "identity" permission.');try{const L=await chrome.identity.getAuthToken({interactive:b,scopes:["https://www.googleapis.com/auth/drive.appdata","https://www.googleapis.com/auth/userinfo.email","https://www.googleapis.com/auth/userinfo.profile"]}),F=L?.token||L;if(!F||typeof F!="string")throw new Error("No token returned from chrome.identity");return E=F,F}catch(L){throw E=null,L}}async function pe(){if(E){try{await chrome.identity.removeCachedAuthToken({token:E})}catch{}E=null}return B(!1)}async function ve(){if(E){if(await he(E))return E;try{await chrome.identity.removeCachedAuthToken({token:E})}catch{}E=null}try{return await B(!1)}catch{return null}}async function he(b){try{return(await fetch(`${s}/about?fields=user`,{headers:{Authorization:`Bearer ${b}`}})).ok}catch{return!1}}async function Ve(b){if(P){try{if((await fetch(`${s}/files/${P}?fields=id,modifiedTime`,{headers:{Authorization:`Bearer ${b}`}})).ok)return P}catch{}P=null}const L=encodeURIComponent(`name='${c}' and trashed=false`),F=await fetch(`${s}/files?q=${L}&spaces=appDataFolder&fields=files(id,modifiedTime)`,{headers:{Authorization:`Bearer ${b}`}});if(!F.ok)throw new Error(`Drive file search failed: ${F.status}`);const we=(await F.json()).files?.[0];return we&&(P=we.id,await W({[d.FILE_ID]:we.id})),we?.id||null}async function ee(b){const L=await Ve(b);if(!L)return null;const F=await fetch(`${s}/files/${L}?alt=media`,{headers:{Authorization:`Bearer ${b}`}});if(F.status===404)return P=null,null;if(!F.ok)throw new Error(`Drive download failed: ${F.status}`);return F.json()}async function $(b,L){const F=await Ve(b),ne={name:c,mimeType:"application/json"};F||(ne.parents=["appDataFolder"]);const we="---EasyCloud"+crypto.getRandomValues(new Uint8Array(8)).reduce((Oe,fe)=>Oe+fe.toString(16).padStart(2,"0"),""),Le=[`--${we}`,"Content-Type: application/json; charset=UTF-8","",JSON.stringify(ne),`--${we}`,"Content-Type: application/json","",JSON.stringify(L),`--${we}--`].join(`\r
`),Ae=F?`${o}/files/${F}?uploadType=multipart`:`${o}/files?uploadType=multipart`,$e=await fetch(Ae,{method:F?"PATCH":"POST",headers:{Authorization:`Bearer ${b}`,"Content-Type":`multipart/related; boundary=${we}`},body:Le});if(!$e.ok){const Oe=await $e.text().catch(()=>"");throw new Error(`Drive upload failed (${$e.status}): ${Oe}`)}const Re=await $e.json();Re.id&&!P&&(P=Re.id,await W({[d.FILE_ID]:Re.id}))}async function be(b){const F=(await C([d.OFFLINE_QUEUE]))[d.OFFLINE_QUEUE]||[];F.push({...b,queuedAt:Date.now()}),F.length>500&&F.splice(0,F.length-500),await W({[d.OFFLINE_QUEUE]:F})}async function se(){const L=(await C([d.OFFLINE_QUEUE]))[d.OFFLINE_QUEUE]||[];L.length!==0&&(Q(`Draining offline queue (${L.length} entries)`),await W({[d.OFFLINE_QUEUE]:[]}),await Ke())}async function He(b,L,F){const ne=new Map((b.scripts||[]).map(fe=>[fe.id,fe])),we=new Map((L.scripts||[]).map(fe=>[fe.id,fe])),Le=b.tombstones||{},Ae=L.tombstones||{},$e={...Le,...Ae},Re=new Set([...ne.keys(),...we.keys()]),Oe=[];for(const fe of Re){if($e[fe])continue;const Ue=ne.get(fe),Pe=we.get(fe);if(!Pe){Oe.push(Ue);continue}if(!Ue){Oe.push(Pe);continue}const Je={...Ue},Et=(Ue.updatedAt||0)>=(Pe.updatedAt||0);if((Pe.updatedAt||0)>(Ue.updatedAt||0)&&(Je.enabled=Pe.enabled,Je.position=Pe.position,Je.settings={...Ue.settings,...Pe.settings}),Ue.code!==Pe.code){const nt=Ue.syncBaseCode||Pe.syncBaseCode||null;if(nt&&nt!==Ue.code&&nt!==Pe.code)try{if(typeof Rt<"u"&&Rt._ensureOffscreen){await Rt._ensureOffscreen();const dt=await chrome.runtime.sendMessage({type:"offscreen_merge",base:nt,local:Ue.code,remote:Pe.code});dt&&!dt.error?(Je.code=dt.merged,dt.conflicts&&(Je.settings={...Je.settings||{},mergeConflict:!0}),Q(`3-way merge for ${fe}: conflicts=${dt.conflicts||!1}`)):Je.code=Et?Ue.code:Pe.code}else Je.code=Et?Ue.code:Pe.code}catch(dt){ae(`3-way merge failed for ${fe}:`,dt.message),Je.code=Et?Ue.code:Pe.code}else Je.code=Et?Ue.code:Pe.code}Je.updatedAt=Math.max(Ue.updatedAt||0,Pe.updatedAt||0),Je.syncBaseCode=Je.code,Je.lastSyncDevice=F,Oe.push(Je)}return{version:1,timestamp:Date.now(),deviceId:F,scripts:Oe,tombstones:$e}}async function Ke(){if(y)return Q("Sync already in progress, skipping"),{skipped:!0};if(!N())return z(f.OFFLINE),{offline:!0};y=!0,z(f.SYNCING);try{const b=await ve();if(!b)return z(f.ERROR),{error:"Not authenticated"};const L=await Y(),ne=(await C(["syncTombstones"])).syncTombstones||{},we=await O.getAll(),Le={version:1,timestamp:Date.now(),deviceId:L,scripts:we.map(Re=>({id:Re.id,code:Re.code,enabled:Re.enabled,position:Re.position,settings:Re.settings||{},updatedAt:Re.updatedAt||0,syncBaseCode:Re.syncBaseCode||null})),tombstones:ne},Ae=await ee(b);if(Ae){const Re=await He(Le,Ae,L);for(const fe of Re.scripts){if(Re.tombstones[fe.id])continue;const Ue=await O.get(fe.id);if(!Ue?.settings?.userModified&&(!Ue||fe.updatedAt>(Ue.updatedAt||0))){const Pe=typeof Ye=="function"?Ye(fe.code):{meta:{},error:null};Pe.error||await O.set(fe.id,{id:fe.id,code:fe.code,meta:Pe.meta,enabled:fe.enabled,position:fe.position,settings:{...Ue?.settings||{},...fe.settings||{},userModified:!1},updatedAt:fe.updatedAt,createdAt:Ue?.createdAt||fe.updatedAt,syncBaseCode:fe.code,lastSyncDevice:L})}}const Oe=Re.tombstones||{};Object.keys(Oe).length>Object.keys(ne).length&&await chrome.storage.local.set({syncTombstones:Oe}),Re.timestamp=Date.now(),await $(b,Re)}else await $(b,Le);const $e=Date.now();await W({[d.LAST_SYNC]:$e});try{await H.set("lastSync",$e)}catch{}return z(f.IDLE),Q("Sync completed successfully"),{success:!0,timestamp:$e}}catch(b){return ae("Sync failed:",b),z(f.ERROR),{error:b.message}}finally{y=!1}}function m(){chrome.alarms.create("easycloud-debounce-sync",{delayInMinutes:5e3/6e4})}async function j(){try{await chrome.alarms.create(r,{delayInMinutes:15,periodInMinutes:15})}catch(b){ae("Failed to create periodic sync alarm:",b)}}async function D(){try{await chrome.alarms.clear(r)}catch{}}function w(b){if(b.name==="easycloud-debounce-sync"){Ke().catch(L=>ae("Debounced sync error:",L));return}b.name===r&&Ke().catch(L=>ae("Periodic sync error:",L))}function T(){Q("Back online, draining queue and syncing"),se().catch(b=>ae("Queue drain error:",b))}function M(){Q("Went offline"),z(f.OFFLINE)}function U(){chrome.storage.onChanged.addListener((b,L)=>{if(L==="local"&&b.userscripts){const F=C([d.CONNECTED]).then(ne=>{ne[d.CONNECTED]&&m()}).catch(()=>{})}})}return{async init(){if(X)return;X=!0;const b=await C([d.CONNECTED,d.DEVICE_ID,d.STATUS,d.FILE_ID]);A=b[d.DEVICE_ID]||null,P=b[d.FILE_ID]||null,b[d.STATUS]&&(h=b[d.STATUS]),U(),chrome.alarms.onAlarm.addListener(w),typeof self<"u"&&(self.addEventListener("online",T),self.addEventListener("offline",M)),b[d.CONNECTED]&&(N()?(await j(),Ke().catch(L=>ae("Init sync error:",L))):z(f.OFFLINE)),Q("Initialized")},async connect(){try{if(chrome.permissions&&chrome.permissions.request&&!await chrome.permissions.request({permissions:["identity"]}))return{success:!1,error:"Identity permission denied"};const b=await B(!0);if(!b)return{success:!1,error:"Authentication failed"};let L={};try{const F=await fetch("https://www.googleapis.com/oauth2/v2/userinfo",{headers:{Authorization:`Bearer ${b}`}});F.ok&&(L=await F.json())}catch{}return await Y(),await W({[d.CONNECTED]:!0,[d.USER_EMAIL]:L.email||"",[d.USER_NAME]:L.name||""}),await j(),Ke().catch(F=>ae("Post-connect sync error:",F)),z(f.IDLE),Q("Connected as",L.email||"(unknown)"),{success:!0,user:{email:L.email,name:L.name,picture:L.picture}}}catch(b){return ae("Connect failed:",b),{success:!1,error:b.message}}},async disconnect(){try{if(E){try{await chrome.identity.removeCachedAuthToken({token:E}),await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${E}`).catch(()=>{})}catch{}E=null}await D(),await W({[d.CONNECTED]:!1,[d.USER_EMAIL]:"",[d.USER_NAME]:"",[d.FILE_ID]:"",[d.OFFLINE_QUEUE]:[],[d.STATUS]:f.IDLE}),P=null,h=f.IDLE;for(const b of x)try{b(f.IDLE)}catch{}return Q("Disconnected"),{success:!0}}catch(b){return ae("Disconnect error:",b),{success:!1,error:b.message}}},async sync(){return N()?(await C([d.CONNECTED]))[d.CONNECTED]?Ke():{error:"Not connected. Call connect() first."}:(z(f.OFFLINE),{offline:!0})},async getStatus(){const b=await C([d.CONNECTED,d.LAST_SYNC,d.STATUS,d.USER_EMAIL,d.USER_NAME,d.DEVICE_ID]);return{connected:!!b[d.CONNECTED],status:b[d.STATUS]||h,lastSync:b[d.LAST_SYNC]||null,user:b[d.CONNECTED]?{email:b[d.USER_EMAIL],name:b[d.USER_NAME]}:null,deviceId:b[d.DEVICE_ID]||null,online:N()}},isConnected(){return h!==f.ERROR&&E!==null},onStatusChange(b){if(typeof b!="function")throw new TypeError("onStatusChange requires a function callback");return x.push(b),()=>{x=x.filter(L=>L!==b)}},notifyScriptSaved(b){if(!N()){be({type:"save",scriptId:b,timestamp:Date.now()});return}m()},notifyScriptDeleted(b){if(!N()){be({type:"delete",scriptId:b,timestamp:Date.now()});return}m()}}})();typeof mt<"u"&&(mt.easycloud={name:"EasyCloud (Google)",icon:"\u26A1",requiresAuth:!1,requiresOAuth:!1,isZeroConfig:!0,async connect(){return et.connect()},async disconnect(){return et.disconnect()},async upload(t,r){const a=await et.sync();if(a.error)throw new Error(a.error);return{success:!0,timestamp:Date.now()}},async download(t){return await et.sync(),null},async test(){const t=await et.getStatus();return{success:t.connected&&t.online}},async getStatus(){const t=await et.getStatus();return{connected:t.connected,user:t.user,status:t.status,lastSync:t.lastSync}}});typeof self<"u"&&(self.EasyCloudSync=et);const ze=(()=>{"use strict";const t="autoBackups",r="backupSchedulerSettings",a="sv_backup_scheduled",e="sv_backup_debounce",c={enabled:!1,scheduleType:"daily",hour:3,dayOfWeek:0,maxBackups:5,notifyOnSuccess:!0,notifyOnFailure:!0,warnOnStorageFull:!0};let u=null,d=!1;function f(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}function h(V){return V<1024?V+" B":V<1048576?(V/1024).toFixed(1)+" KB":(V/1048576).toFixed(2)+" MB"}function y(V,C){const W=new Date,Y=new Date(W);if(Y.setHours(V,0,0,0),C!=null){const N=W.getDay();let B=(C-N+7)%7;B===0&&W>=Y&&(B=7),Y.setDate(Y.getDate()+B)}else W>=Y&&Y.setDate(Y.getDate()+1);return Y}function _(V,C,W=!1){try{chrome.notifications.create({type:"basic",iconUrl:chrome.runtime.getURL("icons/icon128.png"),title:`ScriptVault \u2014 ${V}`,message:C})}catch{}}async function x(){if(u)return u;const V=await chrome.storage.local.get(r);return u={...c,...V[r]||{}},u}async function E(V){u={...c,...V},await chrome.storage.local.set({[r]:u})}async function P(){const V=await O.getAll(),C={},W=new Set;let Y=!1;for(const ee of V){let $=(ee.meta?.name||"unnamed").replace(/[<>:"/\\|?*]/g,"_").replace(/\s+/g," ").trim().substring(0,100);if(W.has($)){let se=2;for(;W.has(`${$}_${se}`);)se++;$=`${$}_${se}`}W.add($),C[`scripts/${$}.user.js`]=Ie.strToU8(ee.code||"");const be={settings:{enabled:ee.enabled,"run-at":ee.meta?.["run-at"]||"document-idle"},meta:{name:ee.meta?.name,namespace:ee.meta?.namespace||"",version:ee.meta?.version||"1.0",description:ee.meta?.description||"",author:ee.meta?.author||"",match:ee.meta?.match||[],include:ee.meta?.include||[],exclude:ee.meta?.exclude||[],grant:ee.meta?.grant||[],require:ee.meta?.require||[],resource:ee.meta?.resource||{}}};C[`scripts/${$}.options.json`]=Ie.strToU8(JSON.stringify(be,null,2));try{const se=await Me.getAll(ee.id);se&&Object.keys(se).length>0&&(C[`scripts/${$}.storage.json`]=Ie.strToU8(JSON.stringify({data:se},null,2)),Y=!0)}catch{}}let N=!1;try{const ee=await H.get();C["global-settings.json"]=Ie.strToU8(JSON.stringify(ee,null,2)),N=!0}catch{}let B=!1;try{const ee=await chrome.storage.local.get("scriptFolders");ee.scriptFolders&&(C["folders.json"]=Ie.strToU8(JSON.stringify(ee.scriptFolders,null,2)),B=!0)}catch{}let pe=!1;try{const ee=await chrome.storage.local.get("workspaces");ee.workspaces&&(C["workspaces.json"]=Ie.strToU8(JSON.stringify(ee.workspaces,null,2)),pe=!0)}catch{}const ve=Ie.zipSync(C,{level:6});let he="";const Ve=8192;for(let ee=0;ee<ve.length;ee+=Ve)he+=String.fromCharCode.apply(null,ve.subarray(ee,ee+Ve));return{base64:btoa(he),scriptCount:V.length,hasGlobalSettings:N,hasFolders:B,hasWorkspaces:pe,hasScriptStorage:Y}}async function A(){return(await chrome.storage.local.get(t))[t]||[]}async function X(V){await chrome.storage.local.set({[t]:V})}function Q(V){let C=0;for(const W of V)C+=W.data?.length||0;return C}async function ae(){await chrome.alarms.clear(a),await chrome.alarms.clear(e);const V=await x();if(V.enabled){if(V.scheduleType==="daily"){const C=y(V.hour),W=C.getTime()-Date.now();chrome.alarms.create(a,{when:C.getTime(),periodInMinutes:1440})}else if(V.scheduleType==="weekly"){const C=y(V.hour,V.dayOfWeek);chrome.alarms.create(a,{when:C.getTime(),periodInMinutes:10080})}}}const z={async init(){d||(d=!0,await x(),await ae(),chrome.alarms.onAlarm.addListener(async V=>{V.name===a?await z.createBackup("scheduled"):V.name===e&&await z.createBackup("onChange")}))},async createBackup(V="manual"){try{const{base64:C,scriptCount:W,hasGlobalSettings:Y,hasFolders:N,hasWorkspaces:B,hasScriptStorage:pe}=await P(),ve=Math.round(C.length*.75),he=await x(),Ve={id:f(),timestamp:Date.now(),version:chrome.runtime.getManifest?.()?.version||"1.0",reason:V,scriptCount:W,hasGlobalSettings:Y,hasFolders:N,hasWorkspaces:B,hasScriptStorage:pe,size:ve,sizeFormatted:h(ve),data:C},ee=await A();if(ee.unshift(Ve),await X(ee),await z.pruneOldBackups(),he.warnOnStorageFull){const $=await A(),be=Q($);be>8388608&&_("Storage Warning",`Backup storage is using ${h(be)}. Consider reducing the backup limit or deleting old backups.`,!0)}return he.notifyOnSuccess&&_("Backup Complete",`${V.charAt(0).toUpperCase()+V.slice(1)} backup created with ${W} scripts (${h(ve)}).`),{success:!0,backupId:Ve.id}}catch(C){return(await x()).notifyOnFailure&&_("Backup Failed",`Error: ${C.message||C}`,!0),console.error("[BackupScheduler] createBackup error:",C),{success:!1,error:C.message||String(C)}}},async getBackups(){return(await A()).map(C=>({id:C.id,timestamp:C.timestamp,version:C.version,reason:C.reason,scriptCount:C.scriptCount,hasGlobalSettings:!!C.hasGlobalSettings,hasFolders:!!C.hasFolders,hasWorkspaces:!!C.hasWorkspaces,hasScriptStorage:!!C.hasScriptStorage,size:C.size,sizeFormatted:C.sizeFormatted}))},async restoreBackup(V,C={}){const Y=(await A()).find(N=>N.id===V);if(!Y)return{success:!1,error:"Backup not found"};try{const N=atob(Y.data),B=new Uint8Array(N.length);for(let m=0;m<N.length;m++)B[m]=N.charCodeAt(m);const pe=Ie.unzipSync(B),ve=Object.keys(pe);let he=0,Ve=0,ee=!1,$=!1,be=!1;const se=[],He=ve.filter(m=>m.endsWith(".user.js"));if(C.selective&&Array.isArray(C.scriptIds))for(const m of He){const j=Ie.strFromU8(pe[m]),D=m.replace(/\.user\.js$/,"");let w={};const T=`${D}.options.json`;if(pe[T])try{w=JSON.parse(Ie.strFromU8(pe[T]))}catch{}const M=w.meta?.name||D.replace(/^scripts\//,""),U=w.meta?.namespace||"",J=U?`${M}::${U}`:M;if(!(!C.scriptIds.includes(M)&&!C.scriptIds.includes(J)))try{const b=w.meta||{},L=w.settings||{},F=await O.getAll(),ne=F.find(Ae=>Ae.meta?.name===b.name&&Ae.meta?.namespace===b.namespace),we=ne?ne.id:st();await O.set(we,{id:we,code:j,meta:b,enabled:L.enabled!==!1,settings:L,position:ne?ne.position:F.length,createdAt:ne?ne.createdAt:Date.now(),updatedAt:Date.now()}),he++;const Le=`${D}.storage.json`;if(pe[Le])try{const Ae=JSON.parse(Ie.strFromU8(pe[Le]));Ae.data&&await Me.setAll(we,Ae.data)}catch(Ae){se.push({name:M,error:Ae.message||String(Ae)})}}catch(b){console.warn("[BackupScheduler] Script import error:",m,b),se.push({name:m,error:b.message||String(b)})}}else try{const m=await ra(Y.data,{overwrite:!0});m?.error&&se.push({name:"archive",error:m.error}),he=m?.imported||0,Ve=m?.skipped||0,Array.isArray(m?.errors)&&se.push(...m.errors)}catch(m){console.warn("[BackupScheduler] Full import error:",m),se.push({name:"archive",error:m.message||String(m)})}if(!C.selective){if(pe["global-settings.json"])try{const m=JSON.parse(Ie.strFromU8(pe["global-settings.json"]));await H.set(m),ee=!0}catch(m){se.push({name:"global-settings.json",error:m.message||String(m)})}if(pe["folders.json"])try{const m=JSON.parse(Ie.strFromU8(pe["folders.json"]));await chrome.storage.local.set({scriptFolders:m}),$=!0}catch(m){se.push({name:"folders.json",error:m.message||String(m)})}if(pe["workspaces.json"])try{const m=JSON.parse(Ie.strFromU8(pe["workspaces.json"]));await chrome.storage.local.set({workspaces:m}),be=!0}catch(m){se.push({name:"workspaces.json",error:m.message||String(m)})}}return{success:se.length===0||he>0||ee||$||be,restoredScripts:he,skippedScripts:Ve,restoredSettings:ee,restoredFolders:$,restoredWorkspaces:be,errors:se}}catch(N){return console.error("[BackupScheduler] restoreBackup error:",N),{success:!1,error:N.message||String(N)}}},async deleteBackup(V){const C=await A(),W=C.filter(Y=>Y.id!==V);return W.length===C.length?{success:!1,error:"Backup not found"}:(await X(W),{success:!0})},async exportBackup(V){const W=(await A()).find(N=>N.id===V);if(!W)return null;const Y=new Date(W.timestamp).toISOString().replace(/[:.]/g,"-");return{zipData:W.data,filename:`scriptvault-autobackup-${Y}.zip`}},async importBackup(V){try{const C=atob(V),W=new Uint8Array(C.length);for(let se=0;se<C.length;se++)W[se]=C.charCodeAt(se);const Y=Ie.unzipSync(W),N=Object.keys(Y),B=N.filter(se=>se.endsWith(".user.js")),pe=N.includes("global-settings.json"),ve=N.includes("folders.json"),he=N.includes("workspaces.json"),Ve=N.some(se=>se.endsWith(".storage.json"));if(B.length===0&&!pe&&!ve&&!he)return{success:!1,error:"This ZIP does not look like a ScriptVault backup archive."};const ee=Math.round(V.length*.75),$={id:f(),timestamp:Date.now(),version:"imported",reason:"imported",scriptCount:B.length,hasGlobalSettings:pe,hasFolders:ve,hasWorkspaces:he,hasScriptStorage:Ve,size:ee,sizeFormatted:h(ee),data:V},be=await A();return be.unshift($),await X(be),await z.pruneOldBackups(),{success:!0,backupId:$.id}}catch(C){return console.error("[BackupScheduler] importBackup error:",C),{success:!1,error:C.message||String(C)}}},getSettings(){return{...c,...u||{}}},async setSettings(V){const C={...await x(),...V};await E(C),await ae();const W=await z.pruneOldBackups();return{...u,prunedCount:W}},async pruneOldBackups(){const V=await x(),C=await A();if(C.length<=V.maxBackups)return 0;const W=C.slice(0,V.maxBackups);return await X(W),Math.max(0,C.length-W.length)},async onScriptChanged(){const V=await x();!V.enabled||V.scheduleType!=="onChange"||(await chrome.alarms.clear(e),chrome.alarms.create(e,{delayInMinutes:5}))},async inspectBackup(V){const W=(await A()).find(Y=>Y.id===V);if(!W)return null;try{const Y=atob(W.data),N=new Uint8Array(Y.length);for(let m=0;m<Y.length;m++)N[m]=Y.charCodeAt(m);const B=Ie.unzipSync(N),pe=Object.keys(B),ve=m=>{if(!B[m])return null;try{return JSON.parse(Ie.strFromU8(B[m]))}catch{return null}},he=m=>Array.isArray(m)?m.length:m&&typeof m=="object"?Object.keys(m).length:0,Ve=ve("global-settings.json"),ee=ve("folders.json"),$=ve("workspaces.json"),be=Array.isArray(ee)?ee:[],se=Array.isArray($?.list)?$.list:Array.isArray($)?$:[],He=pe.filter(m=>m.endsWith(".user.js")).map(m=>{const j=m.replace(/\.user\.js$/,""),D=j.replace(/^scripts\//,"");let w={};const T=`${j}.options.json`;if(B[T])try{w=JSON.parse(Ie.strFromU8(B[T]))?.meta||{}}catch{}const M=w.name||D,U=w.namespace||"";return{id:U?`${M}::${U}`:M,name:M,namespace:U,hasStorage:!!B[`${j}.storage.json`]}}),Ke=He.filter(m=>m.hasStorage).length;return{scriptCount:He.length,scripts:He,scriptsWithStorageCount:Ke,hasGlobalSettings:!!B["global-settings.json"],settingsKeyCount:he(Ve),hasFolders:!!B["folders.json"],folderCount:he(ee),folders:be.map(m=>({id:m?.id||"",name:m?.name||"Unnamed folder",scriptCount:Array.isArray(m?.scriptIds)?m.scriptIds.length:0})),hasWorkspaces:!!B["workspaces.json"],workspaceCount:se.length,workspaces:se.map(m=>({id:m?.id||"",name:m?.name||"Unnamed workspace",scriptCount:m?.snapshot&&typeof m.snapshot=="object"?Object.keys(m.snapshot).length:0,active:$?.active===m?.id})),activeWorkspaceId:$?.active||null}}catch(Y){return console.error("[BackupScheduler] inspectBackup error:",Y),null}}};return z})(),ba=(()=>{"use strict";const t="sv_userstyles",r="sv_userstyle_vars",a=/\/\*\s*==UserStyle==\s*([\s\S]*?)==\/UserStyle==\s*\*\//,e=["color","text","number","select","checkbox","range"],s=/^@(\S+)\s+(.*?)\s*$/;let o={},c={},u=!1,d=new Map;async function f(){try{const w=await chrome.storage.local.get([t,r]);o=w[t]||{},c=w[r]||{}}catch(w){console.error("[UserStylesEngine] Failed to load state:",w),o={},c={}}}async function h(){try{await chrome.storage.local.set({[t]:o})}catch(w){console.error("[UserStylesEngine] Failed to save styles:",w)}}async function y(){try{await chrome.storage.local.set({[r]:c})}catch(w){console.error("[UserStylesEngine] Failed to save variables:",w)}}function _(w,T){const M=T.match(/^(\S+)\s+"([^"]*?)"\s+([\s\S]*)$/);if(!M){const F=T.match(/^(\S+)\s+(.*)$/);return F?{type:w,name:F[1],label:F[1],default:F[2].trim(),options:null}:null}const U=M[1],J=M[2];let b=M[3].trim(),L=null;switch(w){case"color":break;case"text":/^".*"$/.test(b)&&(b=b.slice(1,-1));break;case"number":b=parseFloat(b)||0;break;case"checkbox":b=b==="1"||b==="true";break;case"select":{const F=b.match(/^\{([\s\S]*)\}$/);if(F){L={};const ne=F[1];try{L=JSON.parse(`{${ne}}`),b=Object.keys(L)[0]||""}catch{const we=ne.split("|");let Le=null;for(const Ae of we){const $e=Ae.match(/^"?([^":]+)"?\s*:\s*"?([^"|]*)"?\s*$/);$e&&(L[$e[1].trim()]=$e[2].trim(),Le||(Le=$e[1].trim()))}b=Le||""}}break}case"range":{const F=b.match(/^\[([\s\S]*)\]$/);if(F){const ne=F[1].split(",").map(we=>parseFloat(we.trim()));L={min:ne[0]??0,max:ne[1]??100,step:ne[2]??1},b=ne[3]??ne[0]??0}else b=parseFloat(b)||0,L={min:0,max:100,step:1};break}}return{type:w,name:U,label:J,default:b,options:L}}function x(w){const T=w.match(a);if(!T)return{error:"No ==UserStyle== metadata block found."};const M={name:"Unnamed Style",namespace:"scriptvault",version:"1.0.0",description:"",author:"",license:"",preprocessor:"default",homepageURL:"",supportURL:"",updateURL:""},U=[],b=T[1].split(`
`);for(const we of b){const Le=we.replace(/^\s*\*?\s*/,"").trim();if(!Le||Le.startsWith("//"))continue;const Ae=Le.match(s);if(!Ae)continue;const $e=Ae[1],Re=Ae[2];if($e==="var"){const Oe=Re.match(/^(\S+)\s+([\s\S]+)$/);if(Oe&&e.includes(Oe[1])){const fe=_(Oe[1],Oe[2]);fe&&U.push(fe)}}else $e in M&&(M[$e]=Re)}const L=w.indexOf("==/UserStyle=="),F=w.indexOf("*/",L);let ne="";return F!==-1&&(ne=w.substring(F+2).trim()),{meta:M,variables:U,css:ne}}function E(w,T,M){let U=w;for(const J of T){const b=M&&M[J.name]!==void 0?M[J.name]:J.default,L=new RegExp("/\\*\\[\\["+P(J.name)+"\\]\\]\\*/","g");U=U.replace(L,String(b));const F=new RegExp("<<"+P(J.name)+">>","g");U=U.replace(F,String(b))}return U}function P(w){return w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}function A(w){const T=o[w];if(!T)return"";const M=T.variables||[],U=c[w]||{};return E(T.css,M,U)}async function X(w){u||await f();const T=w.id||`usercss_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,M={id:T,type:"usercss",meta:w.meta||{},variables:w.variables||[],css:w.css||"",rawCode:w.rawCode||"",enabled:w.enabled!==!1,match:w.match||["*://*/*"],installDate:w.installDate||Date.now(),updateDate:Date.now()};return o[T]=M,await h(),M.enabled&&await z(T),T}async function Q(w){u||await f(),await V(w),delete o[w],delete c[w],await Promise.all([h(),y()])}async function ae(w,T){u||await f();const M=o[w];M&&(M.enabled=T,await h(),T?await z(w):await V(w))}async function z(w){const T=o[w];if(!T||!T.enabled)return;const M=A(w);if(M)try{const U=await chrome.tabs.query({});for(const J of U)if(C(J.url,T.match))try{await chrome.scripting.insertCSS({target:{tabId:J.id},css:M}),d.has(J.id)||d.set(J.id,new Set),d.get(J.id).add(w)}catch{}}catch(U){console.error("[UserStylesEngine] Inject failed:",U)}}async function V(w){const T=A(w);if(T)try{const M=await chrome.tabs.query({});for(const U of M){const J=d.get(U.id);if(J&&J.has(w))try{await chrome.scripting.removeCSS({target:{tabId:U.id},css:T}),J.delete(w)}catch{}}}catch(M){console.error("[UserStylesEngine] Remove failed:",M)}}function C(w,T){if(!w||!T||T.length===0)return!1;for(const M of T){if(M==="*://*/*"||M==="<all_urls>")return!0;try{if(W(M).test(w))return!0}catch{if(Y(w,M))return!0}}return!1}function W(w){const T=w.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\\\*/g,".*");return new RegExp("^"+T+"$")}function Y(w,T){const M=T.replace(/[.+?^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*");return new RegExp("^"+M+"$").test(w)}function N(w){const T=o[w];if(!T)return null;const M=c[w]||{};return(T.variables||[]).map(U=>({...U,current:M[U.name]!==void 0?M[U.name]:U.default}))}async function B(w,T){u||await f();const M=o[w];if(M){c[w]||(c[w]={});for(const[U,J]of Object.entries(T))c[w][U]=J;await y(),M.enabled&&(await V(w),await z(w))}}function pe(w){const T=x(w);if(T.error)return{error:T.error};const{meta:M,variables:U,css:J}=T,b={};for(const Ae of U)b[Ae.name]=Ae.default;const F=E(J,U,b).replace(/\\/g,"\\\\").replace(/`/g,"\\`").replace(/\$/g,"\\$");return{script:["// ==UserScript==",`// @name         ${M.name}`,`// @namespace    ${M.namespace}`,`// @version      ${M.version}`,`// @description  ${M.description}`,`// @author       ${M.author}`,"// @match        *://*/*","// @grant        GM_addStyle","// @run-at       document-start","// ==/UserScript==","","(function () {","  'use strict';","","  const css = `",F,"  `;","","  if (typeof GM_addStyle === 'function') {","    GM_addStyle(css);","  } else {","    const style = document.createElement('style');","    style.textContent = css;","    (document.head || document.documentElement).appendChild(style);","  }","})();"].join(`
`),meta:M}}async function ve(w){u||await f();let T;try{T=typeof w=="string"?JSON.parse(w):w}catch(J){return{imported:0,errors:["Invalid JSON: "+J.message]}}Array.isArray(T)||(T=[T]);let M=0;const U=[];for(const J of T)try{const b=he(J);b?(await X(b),M++):U.push(`Skipped style: ${J.name||"unknown"} (no usable sections)`)}catch(b){U.push(`Failed to import "${J.name||"unknown"}": ${b.message}`)}return{imported:M,errors:U}}function he(w){if(!w.sections||w.sections.length===0)return null;const T=[],M=new Set;for(const J of w.sections){let b=J.code||"";if(J.urls&&J.urls.length)for(const L of J.urls)M.add(Ve(L));if(J.urlPrefixes&&J.urlPrefixes.length)for(const L of J.urlPrefixes)M.add(ee(L));if(J.domains&&J.domains.length)for(const L of J.domains)M.add(`*://${L}/*`),M.add(`*://*.${L}/*`);J.regexps&&J.regexps.length&&M.add("*://*/*"),!J.urls?.length&&!J.urlPrefixes?.length&&!J.domains?.length&&!J.regexps?.length&&M.add("*://*/*"),T.push(b)}const U=[...M];return U.length===0&&U.push("*://*/*"),{meta:{name:w.name||"Imported Style",namespace:"stylus-import",version:"1.0.0",description:`Imported from Stylus on ${new Date().toISOString().split("T")[0]}`,author:w.author||"",license:"",preprocessor:"default"},variables:[],css:T.join(`

`),rawCode:"",match:U,enabled:w.enabled!==!1,installDate:w.installDate||Date.now()}}function Ve(w){try{const T=new URL(w);return`${T.protocol}//${T.hostname}${T.pathname}`}catch{return"*://*/*"}}function ee(w){try{const T=new URL(w);return`${T.protocol}//${T.hostname}${T.pathname}*`}catch{return"*://*/*"}}function $(w){if(!w)return!1;try{return new URL(w).pathname.endsWith(".user.css")}catch{return!1}}const be=new Set;async function se(w,T){if(u||await f(),!!T&&!be.has(w)){be.add(w);try{for(const[M,U]of Object.entries(o)){if(!U.enabled||!C(T,U.match))continue;const J=A(M);if(J)try{await chrome.scripting.insertCSS({target:{tabId:w},css:J}),d.has(w)||d.set(w,new Set),d.get(w).add(M)}catch{}}}finally{be.delete(w)}}}function He(w){d.delete(w)}async function Ke(){u||(await f(),u=!0)}function m(){return{...o}}function j(w){return o[w]||null}async function D(w,T){u||await f();const M=o[w];if(M){if(a.test(T)){const U=x(T);U.error||(M.meta=U.meta,M.variables=U.variables,M.css=U.css,M.rawCode=T)}else M.css=T;M.updateDate=Date.now(),await h(),M.enabled&&(await V(w),await z(w))}}return{init:Ke,parseUserCSS:x,registerStyle:X,unregisterStyle:Q,toggleStyle:ae,getVariables:N,setVariables:B,getStyles:m,getStyle:j,updateCSS:D,convertToUserscript:pe,importStylusBackup:ve,isUserCSSUrl:$,onTabUpdated:se,onTabRemoved:He}})();typeof lr<"u"&&lr.exports&&(lr.exports=ba);const lt=(()=>{"use strict";const t="1.0.0",r="publicapi_permissions",a="publicapi_audit",e="publicapi_webhooks",s="publicapi_trusted_origins";let d=null,f=[],h={},y=[],_=!1,x=new Map;const E={ping:"allow",getVersion:"allow",getAPISchema:"allow",getInstalledScripts:"allow",getScriptStatus:"allow",toggleScript:"prompt",installScript:"prompt"},P={version:t,endpoints:{ping:{description:"Health check. Returns { ok: true, version }.",params:null,auth:"none",rateLimit:!0},getVersion:{description:"Return the ScriptVault version string.",params:null,auth:"none",rateLimit:!0},getInstalledScripts:{description:"List all installed scripts with name, version, and enabled status.",params:null,auth:"basic",rateLimit:!0},getScriptStatus:{description:"Get detailed status for a single script.",params:{scriptId:"string \u2014 the script ID"},auth:"basic",rateLimit:!0},toggleScript:{description:"Enable or disable a script. Requires user approval.",params:{scriptId:"string",enabled:"boolean"},auth:"prompt",rateLimit:!0},installScript:{description:"Install a new userscript. Requires user approval.",params:{code:"string \u2014 full userscript source"},auth:"prompt",rateLimit:!0},getAPISchema:{description:"Return the full API schema (this document).",params:null,auth:"none",rateLimit:!1}},webPageEndpoints:{"scriptvault:getScripts":{description:"Returns list of scripts matching the current page.",params:null},"scriptvault:isInstalled":{description:"Check if a script by name is installed.",params:{name:"string"}},"scriptvault:install":{description:"Trigger install flow for a script URL.",params:{url:"string"}}},webhookEvents:["script.installed","script.updated","script.error","script.toggled"]};async function A(){try{const m=await chrome.storage.local.get([r,a,e,s]);d={...E,...m[r]||{}},f=m[a]||[],h=m[e]||{},y=m[s]||[]}catch{d={...E},f=[],h={},y=[]}}async function X(){try{await chrome.storage.local.set({[r]:d})}catch(m){console.warn("[PublicAPI] save permissions failed:",m)}}async function Q(){try{f.length>500&&(f=f.slice(-500)),await chrome.storage.local.set({[a]:f})}catch(m){console.warn("[PublicAPI] save audit failed:",m)}}async function ae(){try{await chrome.storage.local.set({[e]:h})}catch(m){console.warn("[PublicAPI] save webhooks failed:",m)}}async function z(){try{await chrome.storage.local.set({[s]:y})}catch(m){console.warn("[PublicAPI] save origins failed:",m)}}function V(m,j,D,w){const T={timestamp:Date.now(),action:m,sender:C(j),details:D||null,result:w||"ok"};return f.push(T),Q(),T}function C(m){return m?m.id?`extension:${m.id}`:m.origin?`origin:${m.origin}`:m.url?`url:${m.url}`:"unknown":"unknown"}function W(m){const j=Date.now();let D=x.get(m);D||(D=[],x.set(m,D));const w=j-1e3;for(;D.length>0&&D[0]<w;)D.shift();return D.length>=10?!1:(D.push(j),!0)}function Y(m){return d[m]||"deny"}async function N(m,j,D){try{if(chrome.notifications){const w=`sv-api-approval-${Date.now()}`;await chrome.notifications.create(w,{type:"basic",iconUrl:chrome.runtime.getURL("icons/icon128.png"),title:"ScriptVault API Request",message:`External request: ${m} from ${C(j)}. Pre-approve via settings to allow.`,priority:2})}}catch{}return!1}async function B(m,j){const D=Y(m);return D==="allow"?!0:D==="deny"?!1:D==="prompt"?N(m,j):!1}async function pe(){try{const j=(await chrome.storage.local.get("userscripts")).userscripts||{};return Array.isArray(j)?j:Object.values(j)}catch{return[]}}async function ve(m){return(await pe()).find(D=>D.id===m||(D.meta?.name||D.name)===m)||null}async function he(){try{return chrome.runtime.getManifest().version||"0.0.0"}catch{return"0.0.0"}}const Ve={async ping(m,j){return{ok:!0,version:await he(),api:t}},async getVersion(m,j){return{version:await he(),api:t}},async getInstalledScripts(m,j){return{scripts:(await pe()).map(w=>({id:w.id,name:w.meta?.name||w.name||w.id,version:w.meta?.version||w.version||"1.0",enabled:w.enabled!==!1,matchUrls:w.meta?.match||w.matches||w.match||[]}))}},async getScriptStatus(m,j){const D=m.scriptId||m.id;if(!D)return{error:"Missing scriptId parameter"};const w=await ve(D);return w?{id:w.id,name:w.name||w.id,version:w.version||"1.0",enabled:w.enabled!==!1,matches:w.matches||w.match||[],lastModified:w.lastModified||null,runAt:w.runAt||"document_idle"}:{error:"Script not found",scriptId:D}},async toggleScript(m,j){const D=m.scriptId||m.id,w=!!m.enabled;if(!D)return{error:"Missing scriptId parameter"};if(!await B("toggleScript",j))return{error:"Permission denied",action:"toggleScript"};try{const U=(await chrome.storage.local.get("userscripts")).userscripts||{},J=Array.isArray(U)?U:Object.entries(U);let b=!1;if(Array.isArray(U)){const L=U.findIndex(F=>F.id===D||F.meta?.name===D);if(L===-1)return{error:"Script not found",scriptId:D};U[L].enabled=w,b=!0}else{const L=Object.entries(U).find(([F,ne])=>F===D||ne.id===D||ne.meta?.name===D);if(!L)return{error:"Script not found",scriptId:D};U[L[0]].enabled=w,b=!0}return b?(await chrome.storage.local.set({userscripts:U}),be("script.toggled",{scriptId:D,enabled:w}),{ok:!0,scriptId:D,enabled:w}):{error:"Script not found",scriptId:D}}catch(M){return{error:"Failed to toggle script",detail:M.message}}},async installScript(m,j){const D=m.code;if(!D||typeof D!="string")return{error:"Missing or invalid code parameter"};if(!await B("installScript",j))return{error:"Permission denied",action:"installScript"};try{const T=ee(D),M=T.name?T.name.replace(/[^a-zA-Z0-9_-]/g,"_").toLowerCase():`ext_${Date.now()}`,U={id:M,name:T.name||M,version:T.version||"1.0",description:T.description||"",matches:T.match||["*://*/*"],code:D,enabled:!0,installedAt:Date.now(),installedBy:C(j),runAt:T.runAt||"document_idle"},b=(await chrome.storage.local.get("userscripts")).userscripts||{},L=(Array.isArray(b),b);if(Array.isArray(L)){const F=L.findIndex(ne=>ne.id===M);F!==-1?L[F]={...L[F],...U,updatedAt:Date.now()}:L.push(U)}else L[M]?L[M]={...L[M],...U,updatedAt:Date.now()}:L[M]=U;return await chrome.storage.local.set({userscripts:L}),be("script.installed",{scriptId:M,name:U.name,version:U.version}),{ok:!0,scriptId:M,name:U.name}}catch(T){return{error:"Failed to install script",detail:T.message}}},async getAPISchema(m,j){return{schema:P}}};function ee(m){const j={},D=m.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);if(!D)return j;const w=D[1].split(`
`);for(const T of w){const M=T.match(/\/\/\s*@(\S+)\s+(.*)/);if(!M)continue;const U=M[1].trim(),J=M[2].trim();U==="match"||U==="include"?(j.match||(j.match=[]),j.match.push(J)):U==="run-at"?j.runAt=J.replace(/-/g,"_"):j[U]=J}return j}const $={"scriptvault:getScripts":async(m,j)=>({type:"scriptvault:getScripts:response",scripts:(await pe()).map(w=>({name:w.name||w.id,version:w.version||"1.0",enabled:w.enabled!==!1}))}),"scriptvault:isInstalled":async(m,j)=>{const D=m.name;if(!D)return{type:"scriptvault:isInstalled:response",error:"Missing name"};const T=(await pe()).find(M=>(M.name||"").toLowerCase()===D.toLowerCase()||(M.id||"").toLowerCase()===D.toLowerCase());return{type:"scriptvault:isInstalled:response",installed:!!T,name:D,version:T?T.version||"1.0":null}},"scriptvault:install":async(m,j)=>{const D=m.url;if(!D||typeof D!="string")return{type:"scriptvault:install:response",error:"Missing or invalid url"};if(!await B("installScript",{origin:j}))return{type:"scriptvault:install:response",error:"Permission denied",action:"installScript"};try{const T=new URL(D);if(T.protocol!=="https:")return{type:"scriptvault:install:response",error:"Only HTTPS URLs are allowed"};const M=T.hostname;if(M==="localhost"||M==="127.0.0.1"||M==="::1"||M.startsWith("192.168.")||M.startsWith("10.")||M.startsWith("172."))return{type:"scriptvault:install:response",error:"Internal URLs are not allowed"}}catch{return{type:"scriptvault:install:response",error:"Invalid URL"}}try{const T=await fetch(D);if(!T.ok)throw new Error(`HTTP ${T.status}`);const M=await T.text(),U=ee(M),J=U.name?U.name.replace(/[^a-zA-Z0-9_-]/g,"_").toLowerCase():`ext_${Date.now()}`,b={id:J,name:U.name||J,version:U.version||"1.0",description:U.description||"",matches:U.match||["*://*/*"],code:M,enabled:!0,installedAt:Date.now(),installedBy:`origin:${j}`,runAt:U.runAt||"document_idle"},F=(await chrome.storage.local.get("userscripts")).userscripts||[],ne=F.findIndex(we=>we.id===J);return ne!==-1?F[ne]={...F[ne],...b,updatedAt:Date.now()}:F.push(b),await chrome.storage.local.set({userscripts:F}),be("script.installed",{scriptId:J,name:b.name,version:b.version}),{type:"scriptvault:install:response",ok:!0,scriptId:J,name:b.name}}catch(T){return{type:"scriptvault:install:response",error:"Fetch failed",detail:T.message}}}};async function be(m,j){const D=h[m];if(!D||!D.enabled||!D.url)return;const w={event:m,timestamp:Date.now(),version:t,data:j};try{await fetch(D.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(w)})}catch(T){console.warn(`[PublicAPI] webhook ${m} failed:`,T)}}async function se(m,j){const D=m&&m.action;if(!D||typeof D!="string")return{error:"Missing action field"};const w=Ve[D];if(!w)return{error:`Unknown action: ${D}`,availableActions:Object.keys(Ve)};const T=C(j);if(P.endpoints[D]?.rateLimit!==!1&&!W(T))return V(D,j,null,"rate_limited"),{error:"Rate limited. Max 10 requests per second."};if(Y(D)==="deny")return V(D,j,null,"denied"),{error:"Permission denied",action:D};try{const U=await w(m,j);return V(D,j,m,U.error?"error":"ok"),U}catch(U){return V(D,j,m,"exception"),{error:"Internal error",detail:U.message}}}function He(m){if(y.length===0||!y.includes(m.origin)&&!y.includes("*"))return;const j=m.data;if(!j||typeof j!="object"||!j.type||!j.type.startsWith("scriptvault:"))return;const D=`web:${m.origin}`;if(!W(D))return;const w=$[j.type];w&&(V(j.type,{origin:m.origin},j,"processing"),w(j,m.origin).then(T=>{if(T&&m.source)try{m.source.postMessage(T,m.origin==="null"?"*":m.origin)}catch{}}).catch(T=>{console.warn("[PublicAPI] web handler error:",T)}))}function Ke(m,j,D){return se(m,j).then(w=>{try{D(w)}catch{}}),!0}return{async init(){_||(await A(),chrome.runtime.onMessageExternal&&chrome.runtime.onMessageExternal.addListener(Ke),typeof self<"u"&&typeof self.addEventListener=="function"&&self.addEventListener("message",He),_=!0,console.log("[PublicAPI] initialized, version",t))},async handleExternalMessage(m,j){return _||await this.init(),se(m,j)},handleWebMessage(m){He(m)},getAPISchema(){return{...P}},getAuditLog(m=50){const j=Math.max(0,f.length-m);return f.slice(j)},async setPermissions(m){d||await A();for(const[j,D]of Object.entries(m))["allow","deny","prompt"].includes(D)&&(d[j]=D);await X()},getPermissions(){return{...d||E}},async setTrustedOrigins(m){y=Array.isArray(m)?m.slice():[],await z()},getTrustedOrigins(){return y.slice()},async setWebhook(m,j){if(!P.webhookEvents.includes(m))throw new Error(`Unknown event type: ${m}`);const D=j.url||"";if(D&&!D.startsWith("https://"))throw new Error("Webhook URL must use https://");h[m]={url:D,enabled:!!j.enabled},await ae()},getWebhooks(){return{...h}},async fireEvent(m,j){V("fireEvent",{id:"internal"},{eventType:m,payload:j},"ok"),await be(m,j)},async clearAuditLog(){f=[],await Q()}}})(),Xr=(()=>{"use strict";const t="2.0.0",r="sv_lastMigratedVersion";async function a(){try{const u=(await chrome.storage.local.get(r))[r]||"0.0.0";if(u===t)return;console.log(`[Migration] Migrating from ${u} to ${t}`),o(u,"2.0.0")<0&&await e(),await chrome.storage.local.set({[r]:t}),console.log("[Migration] Complete")}catch(c){console.error("[Migration] Error:",c)}}async function e(){console.log("[Migration] Running v1.x \u2192 v2.0 migration..."),(await chrome.storage.local.get("installDate")).installDate||await chrome.storage.local.set({installDate:Date.now()}),(await chrome.storage.local.get("notificationPrefs")).notificationPrefs||await chrome.storage.local.set({notificationPrefs:{updates:!0,errors:!0,digest:!1,security:!0,quietStart:null,quietEnd:null}}),(await chrome.storage.local.get("backupSchedulerSettings")).backupSchedulerSettings||await chrome.storage.local.set({backupSchedulerSettings:{enabled:!0,type:"weekly",hour:3,day:0,maxBackups:5,onChange:!0}});const f=await s();let h=0;for(const[x,E]of Object.entries(f)){let P=!1;E.settings||(E.settings={},P=!0),E.stats||(E.stats={runs:0,totalTime:0,avgTime:0,errors:0},P=!0),E.metadata&&!E.meta&&(E.meta=E.metadata,delete E.metadata,P=!0),!E.installedAt&&E.createdAt&&(E.installedAt=E.createdAt,P=!0),P&&(f[x]=E,h++)}h>0&&(await chrome.storage.local.set({userscripts:f}),console.log(`[Migration] Migrated ${h} script(s)`));const y=["tm_settings","lastChecked"];await chrome.storage.local.remove(y).catch(()=>{}),(await chrome.storage.local.get("gamification")).gamification||await chrome.storage.local.set({gamification:{achievements:{},streaks:{daily:{current:0,longest:0,lastDate:null},creation:{current:0,longest:0,lastDate:null}},points:0,level:1,firstSeen:Date.now()}}),console.log("[Migration] v2.0 migration complete")}async function s(){const c=await chrome.storage.local.get("userscripts");return c.userscripts&&typeof c.userscripts=="object"?c.userscripts:{}}function o(c,u){const d=c.split(".").map(Number),f=u.split(".").map(Number);for(let h=0;h<Math.max(d.length,f.length);h++){const y=d[h]||0,_=f[h]||0;if(y>_)return 1;if(y<_)return-1}return 0}return{run:a}})(),Tt=(()=>{"use strict";let s=null;async function o(){if(s!==null)return s;if(typeof navigator<"u"&&navigator.storage?.estimate)try{const h=await navigator.storage.estimate();if(h.quota)return s=h.quota,s}catch{}try{if((await chrome.permissions.getAll()).permissions?.includes("unlimitedStorage"))return s=524288e3,s}catch{}return s=10485760,s}async function c(){const h=await o(),y=await chrome.storage.local.getBytesInUse(null),_=y/h,x=_>=.95?"critical":_>=.85?"warning":"ok";return{bytesUsed:y,quota:h,percentage:_,level:x}}async function u(){const h=await chrome.storage.local.get(null),y={scripts:{count:0,bytes:0},scriptValues:{count:0,bytes:0},requireCache:{count:0,bytes:0},resourceCache:{count:0,bytes:0},backups:{count:0,bytes:0},analytics:{count:0,bytes:0},settings:{count:0,bytes:0},other:{count:0,bytes:0}};for(const[_,x]of Object.entries(h)){const E=JSON.stringify(x).length;_==="userscripts"||_.startsWith("script_")?(y.scripts.count++,y.scripts.bytes+=E):_.startsWith("values_")||_.startsWith("SV_GM_")?(y.scriptValues.count++,y.scriptValues.bytes+=E):_.startsWith("require_cache_")?(y.requireCache.count++,y.requireCache.bytes+=E):_.startsWith("res_cache_")?(y.resourceCache.count++,y.resourceCache.bytes+=E):_.startsWith("autoBackup")||_==="autoBackups"?(y.backups.count++,y.backups.bytes+=E):_.startsWith("sv_analytics")||_==="analytics"||_==="perfHistory"?(y.analytics.count++,y.analytics.bytes+=E):_==="settings"||_.startsWith("sv_")||_.startsWith("notification")||_.startsWith("gamification")?(y.settings.count++,y.settings.bytes+=E):(y.other.count++,y.other.bytes+=E)}return y}async function d(h={}){const y=[];let _=0;if(h.requireCache!==!1){const x=await chrome.storage.local.get(null),E=[],P=Date.now();for(const[A,X]of Object.entries(x))A.startsWith("require_cache_")&&X.timestamp&&P-X.timestamp>10080*60*1e3&&(E.push(A),_+=JSON.stringify(X).length),A.startsWith("res_cache_")&&X.timestamp&&P-X.timestamp>10080*60*1e3&&(E.push(A),_+=JSON.stringify(X).length);E.length>0&&(await chrome.storage.local.remove(E),y.push(`Removed ${E.length} expired cache entries`))}if(h.errorLog!==!1){const x=await chrome.storage.local.get("errorLog");if(x.errorLog&&x.errorLog.length>200){const E=x.errorLog.slice(-200),P=x.errorLog.length-E.length;await chrome.storage.local.set({errorLog:E}),y.push(`Pruned ${P} error log entries`),_+=P*300}}if(h.cspReports!==!1){const x=await chrome.storage.local.get("sv_csp_reports");if(x.sv_csp_reports&&x.sv_csp_reports.length>100){const E=x.sv_csp_reports.slice(-100);await chrome.storage.local.set({sv_csp_reports:E}),y.push("Pruned old CSP reports")}}if(h.tombstones!==!1){const x=await chrome.storage.local.get("syncTombstones");if(x.syncTombstones){const E=Date.now(),P=720*60*60*1e3;let A=0;for(const[X,Q]of Object.entries(x.syncTombstones))E-Q>P&&(delete x.syncTombstones[X],A++);A>0&&(await chrome.storage.local.set({syncTombstones:x.syncTombstones}),y.push(`Pruned ${A} sync tombstones`))}}return h.npmCache&&(await chrome.storage.local.remove("npmCache"),y.push("Cleared npm package cache"),_+=5e3),{freedBytes:_,actions:y}}async function f(){const h=await c();if(h.level==="ok")return null;console.log(`[QuotaManager] Storage at ${(h.percentage*100).toFixed(1)}% \u2014 running cleanup`);const y=await d({npmCache:h.level==="critical"});return h.level==="critical"&&y.freedBytes<5e5&&await d({analytics:!0,perfHistory:!0,errorLog:!0,cspReports:!0}),y}return{getUsage:c,getBreakdown:u,cleanup:d,autoCleanup:f}})(),Rt={async analyzeAsync(t){try{await Rt._ensureOffscreen();const r=await chrome.runtime.sendMessage({type:"offscreen_analyze",code:t});if(r&&!r.parseError)return r}catch(r){xe("[Analyzer] Offscreen failed, using regex fallback:",r.message)}return Rt.analyze(t)},_offscreenPromise:null,async _ensureOffscreen(){if(!chrome.offscreen)throw new Error("Offscreen API not available");return this._offscreenPromise||(this._offscreenPromise=(async()=>{await chrome.offscreen.hasDocument().catch(()=>!1)||await chrome.offscreen.createDocument({url:chrome.runtime.getURL("offscreen.html"),reasons:["DOM_SCRAPING"],justification:"AST-based script analysis with Acorn parser"})})().catch(t=>{throw this._offscreenPromise=null,t})),this._offscreenPromise},patterns:[{id:"eval",regex:/\beval\s*\(/g,label:"eval() call",risk:30,category:"execution",desc:"Dynamic code execution can run arbitrary code"},{id:"function-ctor",regex:/\bnew\s+Function\s*\(/g,label:"new Function()",risk:30,category:"execution",desc:"Creates functions from strings, equivalent to eval"},{id:"settimeout-str",regex:/setTimeout\s*\(\s*['\"`]/g,label:"setTimeout with string",risk:20,category:"execution",desc:"String argument to setTimeout acts like eval"},{id:"setinterval-str",regex:/setInterval\s*\(\s*['\"`]/g,label:"setInterval with string",risk:20,category:"execution",desc:"String argument to setInterval acts like eval"},{id:"document-write",regex:/document\.write\s*\(/g,label:"document.write()",risk:10,category:"execution",desc:"Can overwrite entire page content"},{id:"innerhtml-assign",regex:/\.innerHTML\s*=/g,label:"innerHTML assignment",risk:5,category:"execution",desc:"Can inject HTML including scripts (XSS risk)"},{id:"cookie-access",regex:/document\.cookie/g,label:"Cookie access",risk:25,category:"data",desc:"Can read or modify browser cookies"},{id:"localstorage",regex:/localStorage\.(get|set|remove)Item/g,label:"localStorage access",risk:10,category:"data",desc:"Reads or writes persistent page data"},{id:"sessionstorage",regex:/sessionStorage\.(get|set|remove)Item/g,label:"sessionStorage access",risk:5,category:"data",desc:"Reads or writes session data"},{id:"indexeddb",regex:/indexedDB\.open/g,label:"IndexedDB access",risk:10,category:"data",desc:"Opens browser database"},{id:"fetch-call",regex:/\bfetch\s*\(/g,label:"fetch() call",risk:10,category:"network",desc:"Makes network requests (same-origin)"},{id:"xhr-open",regex:/XMLHttpRequest|\.open\s*\(\s*['""](?:GET|POST|PUT|DELETE)/gi,label:"XMLHttpRequest",risk:10,category:"network",desc:"Makes network requests"},{id:"websocket",regex:/new\s+WebSocket\s*\(/g,label:"WebSocket",risk:20,category:"network",desc:"Opens persistent connection to a server"},{id:"beacon",regex:/navigator\.sendBeacon/g,label:"sendBeacon()",risk:15,category:"network",desc:"Sends data to a server, often used for tracking"},{id:"canvas-fp",regex:/\.toDataURL\s*\(|\.getImageData\s*\(/g,label:"Canvas fingerprinting",risk:20,category:"fingerprint",desc:"Can generate unique device fingerprint via canvas"},{id:"webgl-fp",regex:/getExtension\s*\(\s*['""]WEBGL/g,label:"WebGL fingerprinting",risk:20,category:"fingerprint",desc:"Can identify GPU for device fingerprinting"},{id:"audio-fp",regex:/AudioContext|OfflineAudioContext/g,label:"Audio fingerprinting",risk:15,category:"fingerprint",desc:"Can generate audio-based device fingerprint"},{id:"navigator-props",regex:/navigator\.(platform|userAgent|language|hardwareConcurrency|deviceMemory|plugins)/g,label:"Navigator property access",risk:5,category:"fingerprint",desc:"Reads browser/device information"},{id:"atob-long",regex:/atob\s*\(\s*['""][A-Za-z0-9+/=]{100,}['"]\s*\)/g,label:"Large base64 decode",risk:25,category:"obfuscation",desc:"Decodes large embedded base64 data (possible obfuscation)"},{id:"hex-escape",regex:/\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){10,}/g,label:"Hex escape sequences",risk:20,category:"obfuscation",desc:"Long hex-encoded strings suggest obfuscated code"},{id:"char-fromcode",regex:/String\.fromCharCode\s*\([^)]{20,}\)/g,label:"String.fromCharCode chain",risk:15,category:"obfuscation",desc:"Building strings from char codes (obfuscation technique)"},{id:"wasm-mining",regex:/WebAssembly\.(instantiate|compile|Module)/g,label:"WebAssembly usage",risk:15,category:"mining",desc:"WebAssembly can be used for crypto mining"},{id:"worker-creation",regex:/new\s+Worker\s*\(/g,label:"Web Worker creation",risk:10,category:"mining",desc:"Workers can run background computations"},{id:"form-submit",regex:/\.submit\s*\(\s*\)/g,label:"Form auto-submit",risk:15,category:"hijack",desc:"Automatically submits forms"},{id:"window-open",regex:/window\.open\s*\(/g,label:"window.open()",risk:5,category:"hijack",desc:"Opens new windows/popups"},{id:"location-assign",regex:/(?:window\.|document\.)?location\s*=|location\.(?:href|assign|replace)\s*=/g,label:"Page redirect",risk:10,category:"hijack",desc:"Redirects the page to another URL"},{id:"event-prevent",regex:/addEventListener\s*\(\s*['""](?:beforeunload|unload)['"]/g,label:"Unload handler",risk:10,category:"hijack",desc:"Prevents or intercepts page navigation"},{id:"proto-pollution",regex:/__proto__|Object\.setPrototypeOf\s*\(|prototype\[/g,label:"Prototype manipulation",risk:25,category:"hijack",desc:"Modifying object prototypes can corrupt global state and affect other scripts"},{id:"document-domain",regex:/document\.domain\s*=/g,label:"document.domain assignment",risk:20,category:"hijack",desc:"Changing document.domain relaxes same-origin restrictions"},{id:"postmessage-noorigin",regex:/postMessage\s*\([^,)]+,\s*['"]\*['"]/g,label:"postMessage with wildcard origin",risk:15,category:"hijack",desc:"Sending postMessage to any origin (* target) can leak data to malicious frames"},{id:"defineProperty-global",regex:/Object\.defineProperty\s*\(\s*(?:window|globalThis|self|unsafeWindow)\s*,/g,label:"Global property definition",risk:10,category:"hijack",desc:"Defining properties on the global object can interfere with page code"}],analyze(t){const r=[];let a=0;const e=t.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"");for(const u of this.patterns){u.regex.lastIndex=0;const d=e.match(u.regex);if(d&&d.length>0){const f=d.length,h=Math.min(u.risk*Math.min(f,3),u.risk*3);a+=h,r.push({id:u.id,label:u.label,category:u.category,desc:u.desc,risk:u.risk,count:f,adjustedRisk:h})}}const s=e.match(/['"][^'"]{80,}['"]/g);if(s&&s.length>0){const u=this.calculateEntropy(s[0]),d=s[0].length>=200?4.5:5.2;u>d&&(r.push({id:"high-entropy",label:"High-entropy string detected",category:"obfuscation",desc:`Found ${s.length} long string(s) with high randomness (entropy: ${u.toFixed(1)})`,risk:20,count:s.length,adjustedRisk:20}),a+=20)}const o=a>=80?"high":a>=40?"medium":a>=15?"low":"minimal",c={};for(const u of r)c[u.category]||(c[u.category]=[]),c[u.category].push(u);return{totalRisk:Math.min(a,100),riskLevel:o,findings:r,categories:c,summary:this.generateSummary(o,r),astAnalyzed:!1}},calculateEntropy(t){const r={};for(const s of t)r[s]=(r[s]||0)+1;let a=0;const e=t.length;for(const s of Object.values(r)){const o=s/e;a-=o*Math.log2(o)}return a},generateSummary(t,r){if(!r.length)return"No suspicious patterns detected.";const a=[...new Set(r.map(s=>s.category))],e={execution:"dynamic code execution",data:"data access",network:"network activity",fingerprint:"device fingerprinting",obfuscation:"code obfuscation",mining:"potential mining",hijack:"page manipulation"};return`Found ${r.length} pattern(s) involving ${a.map(s=>e[s]||s).join(", ")}.`}},Ct={_log:[],_maxEntries:2e3,add(t){this._log.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),timestamp:Date.now(),...t}),this._log.length>this._maxEntries&&(this._log=this._log.slice(-this._maxEntries))},getAll(t={}){let r=[...this._log].reverse();return t.scriptId&&(r=r.filter(a=>a.scriptId===t.scriptId)),t.method&&(r=r.filter(a=>a.method?.toUpperCase()===t.method.toUpperCase())),t.domain&&(r=r.filter(a=>{try{return new URL(a.url).hostname.includes(t.domain)}catch{return!1}})),t.status&&(t.status==="error"?r=r.filter(a=>a.error||a.status&&a.status>=400):t.status==="success"&&(r=r.filter(a=>!a.error&&a.status&&a.status<400))),r.slice(0,t.limit||100)},getStats(){const t={},r={};let a=0,e=0,s=0;for(const o of this._log){a++,(o.error||o.status&&o.status>=400)&&e++,s+=o.responseSize||0;const c=o.scriptId||"unknown";t[c]||(t[c]={count:0,errors:0,bytes:0,scriptName:o.scriptName||c}),t[c].count++;const u=!!(o.error||o.status&&o.status>=400);u&&t[c].errors++,t[c].bytes+=o.responseSize||0;try{const d=new URL(o.url).hostname;r[d]||(r[d]={count:0,errors:0,bytes:0}),r[d].count++,u&&r[d].errors++,r[d].bytes+=o.responseSize||0}catch{}}return{totalRequests:a,totalErrors:e,totalBytes:s,byScript:t,byDomain:r}},clear(t){t?this._log=this._log.filter(r=>r.scriptId!==t):this._log=[]}},_t={async getOrCreateKeypair(){const t=await chrome.storage.local.get("signingKeypair");return t.signingKeypair?t.signingKeypair:this.generateAndStoreKeypair()},async generateAndStoreKeypair(){const t=await crypto.subtle.generateKey({name:"Ed25519"},!0,["sign","verify"]),r=await crypto.subtle.exportKey("jwk",t.publicKey),a=await crypto.subtle.exportKey("jwk",t.privateKey),e={publicKeyJwk:r,privateKeyJwk:a};return await chrome.storage.local.set({signingKeypair:e}),e},async getPublicKeyJwk(){return(await this.getOrCreateKeypair()).publicKeyJwk},async signScript(t){const r=await this.getOrCreateKeypair(),a=await crypto.subtle.importKey("jwk",r.privateKeyJwk,{name:"Ed25519"},!1,["sign"]),e=new TextEncoder,s=await crypto.subtle.sign({name:"Ed25519"},a,e.encode(t)),o=btoa(String.fromCharCode(...new Uint8Array(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""),c=r.publicKeyJwk.x;return{signature:o,publicKey:c,algorithm:"Ed25519",timestamp:Date.now()}},async verifyScript(t,r){if(!r?.signature||!r?.publicKey)return{valid:!1,reason:"Missing signature or public key"};try{const a={kty:"OKP",crv:"Ed25519",x:r.publicKey,key_ops:["verify"]},e=await crypto.subtle.importKey("jwk",a,{name:"Ed25519"},!1,["verify"]),s=new TextEncoder,o=r.signature.replace(/-/g,"+").replace(/_/g,"/"),c=Uint8Array.from(atob(o),y=>y.charCodeAt(0));if(!await crypto.subtle.verify({name:"Ed25519"},e,c,s.encode(t)))return{valid:!1,reason:"Signature verification failed"};const h=((await H.get()).trustedSigningKeys||{})[r.publicKey];return{valid:!0,trusted:!!h,trustedName:h?.name||null,publicKey:r.publicKey,timestamp:r.timestamp}}catch(a){return{valid:!1,reason:"Verification error: "+a.message}}},async trustKey(t,r){if(["__proto__","constructor","prototype"].includes(t))return{error:"Invalid key"};const e=(await H.get()).trustedSigningKeys||{};return e[t]={name:r||t.slice(0,12)+"\u2026",addedAt:Date.now()},await H.set({trustedSigningKeys:e}),{success:!0}},async untrustKey(t){const a=(await H.get()).trustedSigningKeys||{};return delete a[t],await H.set({trustedSigningKeys:a}),{success:!0}},async getTrustedKeys(){return(await H.get()).trustedSigningKeys||{}},async signAndEmbedInCode(t){const r=t.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g,""),a=await this.signScript(r),e=`// @signature ${a.signature}|${a.publicKey}|${a.timestamp}`;return r.includes("==/UserScript==")?r.replace(/(\/\/\s*==\/UserScript==)/,e+`
$1`):e+`
`+r},extractSignatureFromCode(t){const r=t.match(/\/\/\s*@signature\s+([^\r\n]+)/);if(!r)return null;const a=r[1].trim().split("|");return a.length<2?null:{signature:a[0],publicKey:a[1],timestamp:a[2]?parseInt(a[2]):null}},async verifyCodeSignature(t){const r=this.extractSignatureFromCode(t);if(!r)return{valid:!1,reason:"No signature found in script"};const a=t.replace(/\/\/\s*@signature\s+[^\r\n]+\r?\n?/g,"");return this.verifyScript(a,r)}},Pt={_cache:null,async _init(){if(this._cache!==null)return;const t=await chrome.storage.local.get("workspaces");this._cache=t.workspaces||{active:null,list:[]}},async _save(){await chrome.storage.local.set({workspaces:this._cache})},async getAll(){return await this._init(),{active:this._cache.active,list:this._cache.list}},async create(t){await this._init();const r=await O.getAll(),a={};for(const s of r)a[s.id]=s.enabled!==!1;const e={id:st(),name:t,snapshot:a,createdAt:Date.now(),updatedAt:Date.now()};return this._cache.list.push(e),await this._save(),e},async update(t,r){await this._init();const a=this._cache.list.find(e=>e.id===t);return a?(r.name!==void 0&&(a.name=r.name),a.updatedAt=Date.now(),await this._save(),a):null},async save(t){await this._init();const r=this._cache.list.find(e=>e.id===t);if(!r)return null;const a=await O.getAll();r.snapshot={};for(const e of a)r.snapshot[e.id]=e.enabled!==!1;return r.updatedAt=Date.now(),await this._save(),r},async activate(t){await this._init();const r=this._cache.list.find(s=>s.id===t);if(!r)return{error:"Workspace not found"};const a=await O.getAll(),e=Date.now();for(const s of a){const o=r.snapshot[s.id];o!==void 0&&s.enabled!==!1!==o&&await O.set(s.id,{...s,enabled:o,updatedAt:e})}return this._cache.active=t,await this._save(),await tt(),await Be(),{success:!0,name:r.name}},async delete(t){await this._init();const r=this._cache.list.findIndex(e=>e.id===t);if(r===-1)return null;const[a]=this._cache.list.splice(r,1);return this._cache.active===t&&(this._cache.active=null),await this._save(),a}};console.log("[ScriptVault] Service worker starting...");let Dr=!1;function xe(...t){Dr&&console.log("[ScriptVault]",...t)}function Sa(...t){Dr&&console.warn("[ScriptVault]",...t)}(async()=>{try{Dr=(await chrome.storage.local.get("settings")).settings?.debugMode===!0}catch{}})();function Ye(t){const r=t.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);if(!r)return{error:"No metadata block found. Scripts must include ==UserScript== header."};const a={name:"Unnamed Script",namespace:"scriptvault",version:"1.0.0",description:"",author:"",match:[],include:[],exclude:[],excludeMatch:[],grant:[],require:[],resource:{},"run-at":"document-idle",noframes:!1,icon:"",icon64:"",homepage:"",homepageURL:"",website:"",source:"",updateURL:"",downloadURL:"",supportURL:"",connect:[],antifeature:[],unwrap:!1,"inject-into":"auto",sandbox:"",tag:[],"run-in":"","top-level-await":!1,license:"",copyright:"",contributionURL:"",compatible:[],incompatible:[],webRequest:null,priority:0},s=r[1].split(`
`);for(const o of s){const c=o.match(/\/\/\s*@(\S+)(?:\s+(.*))?/);if(!c)continue;const u=c[1].trim(),d=(c[2]||"").trim();switch(u){case"name":case"namespace":case"version":case"description":case"author":case"icon":case"icon64":case"homepage":case"homepageURL":case"website":case"source":case"updateURL":case"downloadURL":case"supportURL":case"run-at":case"inject-into":case"sandbox":case"run-in":case"license":case"copyright":case"contributionURL":a[u]=d;break;case"match":case"include":case"exclude":case"exclude-match":case"excludeMatch":case"grant":case"require":case"connect":case"antifeature":case"tag":case"compatible":case"incompatible":const f=u==="exclude-match"?"excludeMatch":u;a[f]||(a[f]=[]),d&&a[f].push(d);break;case"resource":const h=d.match(/^(\S+)\s+(.+)$/);h&&(a.resource[h[1]]=h[2]);break;case"noframes":a.noframes=!0;break;case"unwrap":a.unwrap=!0;break;case"nodownload":a.nodownload=!0;break;case"delay":a.delay=Math.max(0,parseInt(d,10)||0);break;case"top-level-await":a["top-level-await"]=!0;break;case"priority":a.priority=parseInt(d,10)||0;break;case"webRequest":try{a.webRequest=JSON.parse(d)}catch{}break;default:if(u.includes(":")){const y=u.indexOf(":"),_=u.slice(0,y),x=u.slice(y+1);_&&x&&(a.localized||(a.localized={}),a.localized[x]||(a.localized[x]={}),a.localized[x][_]=d)}}}return a.grant.length===0&&(a.grant=["none"]),{meta:a,code:t,metaBlock:r[0]}}const ir={async checkForUpdates(t=null){const r=t?[await O.get(t)].filter(Boolean):await O.getAll(),a=[];for(const e of r)if(!e.meta.nodownload&&!(!e.meta.updateURL&&!e.meta.downloadURL))try{const s=e.meta.updateURL||e.meta.downloadURL,o={};e._httpEtag&&(o["If-None-Match"]=e._httpEtag),e._httpLastModified&&(o["If-Modified-Since"]=e._httpLastModified);const c=await fetch(s,{headers:o});if(c.status===304||!c.ok)continue;const u=c.headers.get("etag"),d=c.headers.get("last-modified");(u||d)&&(e._httpEtag=u||"",e._httpLastModified=d||"",await O.set(e.id,e));const f=await c.text(),h=Ye(f);if(h.error)continue;this.compareVersions(h.meta.version,e.meta.version)>0&&a.push({id:e.id,name:e.meta.name,currentVersion:e.meta.version,newVersion:h.meta.version,code:f})}catch(s){console.error("[ScriptVault] Update check failed for:",e.meta.name,s)}return a},compareVersions(t,r){const a=t.includes("-"),e=r.includes("-"),s=(typeof t=="string"?t:String(t)).replace(/-.*$/,""),o=(typeof r=="string"?r:String(r)).replace(/-.*$/,""),c=s.split(".").map(d=>parseInt(d,10)||0),u=o.split(".").map(d=>parseInt(d,10)||0);for(let d=0;d<Math.max(c.length,u.length);d++){const f=c[d]||0,h=u[d]||0;if(f>h)return 1;if(f<h)return-1}return a&&!e?-1:!a&&e?1:0},async applyUpdate(t,r){const a=await O.get(t);if(!a)return{error:"Script not found"};if(a.settings?.userModified)return{skipped:!0,reason:"user-modified"};const e=Ye(r);if(e.error)return e;a.versionHistory||(a.versionHistory=[]),a.versionHistory.push({version:a.meta.version,code:a.code,updatedAt:a.updatedAt||Date.now()}),a.versionHistory.length>5&&(a.versionHistory=a.versionHistory.slice(-5)),a.code=r,a.meta=e.meta,a.updatedAt=Date.now();try{await It(t),a.enabled!==!1&&await ft(a)}catch(o){console.error(`[ScriptVault] Failed to re-register ${a.meta.name} after update:`,o),a.settings=a.settings||{},a.settings._registrationError=o.message||"Registration failed after update"}return await O.set(t,a),(await H.get()).notifyOnUpdate&&chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Script Updated",message:`${a.meta.name} updated to v${a.meta.version}`}),{success:!0,script:a}},async autoUpdate(){if(!(await H.get()).autoUpdate)return;const r=await this.checkForUpdates(),e=(await Promise.allSettled(r.map(s=>this.applyUpdate(s.id,s.code)))).filter(s=>s.status==="rejected");e.length>0&&console.error("[ScriptVault] Auto-update failures:",e.map(s=>s.reason?.message||s.reason)),await H.set("lastUpdateCheck",Date.now())}},cr={get providers(){return mt},_syncInProgress:!1,async sync(){if(this._syncInProgress)return xe("[CloudSync] Sync already in progress, skipping"),{skipped:!0};this._syncInProgress=!0;let t;try{const r=new Promise((a,e)=>{t=setTimeout(()=>e(new Error("Sync timed out after 90s")),9e4)});return await Promise.race([this._performSync(),r])}catch(r){return console.error("[ScriptVault] Sync failed:",r),{error:r.message}}finally{clearTimeout(t),this._syncInProgress=!1}},async _performSync(){const t=await H.get();if(!t.syncEnabled||t.syncProvider==="none")return;const r=this.providers[t.syncProvider];if(!r)return;const e=(await chrome.storage.local.get("syncTombstones")).syncTombstones||{},s=await O.getAll(),o={version:1,timestamp:Date.now(),scripts:s.map(u=>({id:u.id,code:u.code,enabled:u.enabled,position:u.position,settings:u.settings||{},updatedAt:u.updatedAt})),tombstones:e},c=await r.download(t);if(c){const u={...e,...c.tombstones||{}},d=this.mergeData(o,c);for(const f of d.scripts){if(u[f.id])continue;const h=await O.get(f.id);if(h?.settings?.userModified)continue;const y=c.scripts?.find(P=>P.id===f.id),_=o.scripts?.find(P=>P.id===f.id);let x=f.code,E=!1;if(h&&y&&_&&h.code!==y.code&&h.code!==_.code){const P=h.syncBaseCode||h.code;if(P&&P!==_.code&&P!==y.code)try{await Rt._ensureOffscreen();const A=await chrome.runtime.sendMessage({type:"offscreen_merge",base:P,local:_.code,remote:y.code});A&&!A.error&&(x=A.merged,E=A.conflicts||!1,xe(`[CloudSync] 3-way merge for ${f.id}: conflicts=${E}`))}catch(A){xe("[CloudSync] 3-way merge failed, using timestamp winner:",A.message),E=!0}}if(!h||f.updatedAt>h.updatedAt||E){const P=Ye(x);P.error||await O.set(f.id,{id:f.id,code:x,meta:P.meta,enabled:f.enabled,position:f.position,settings:{...h?.settings||{},...E?{mergeConflict:!0}:{}},updatedAt:Math.max(f.updatedAt,h?.updatedAt||0),createdAt:h?.createdAt||f.updatedAt,syncBaseCode:x})}}Object.keys(u).length>Object.keys(e).length&&await chrome.storage.local.set({syncTombstones:u}),d.timestamp=Date.now(),d.tombstones=u,await r.upload(d,t)}else await r.upload(o,t);return await H.set("lastSync",Date.now()),{success:!0}},mergeData(t,r){const a=new Map;for(const e of t.scripts)a.set(e.id,e);for(const e of r.scripts){const s=a.get(e.id);(!s||e.updatedAt>s.updatedAt)&&a.set(e.id,e)}return{version:1,timestamp:Date.now(),scripts:Array.from(a.values()),tombstones:{...t.tombstones||{},...r.tombstones||{}}}}};async function Qr(t={}){const{includeSettings:r=!0,includeStorage:a=!1}=t,e=await O.getAll(),s=r?await H.get():null,o=await Promise.all(e.map(async c=>{const u={id:c.id,code:c.code,enabled:c.enabled,position:c.position,createdAt:c.createdAt,updatedAt:c.updatedAt};if(r&&c.settings&&typeof c.settings=="object"&&(u.settings={...c.settings}),a){const d=await Me.getAll(c.id);d&&Object.keys(d).length>0&&(u.storage=d)}return u}));return{version:2,exportedAt:new Date().toISOString(),...r?{settings:s}:{},scripts:o}}async function Zr(t,r={}){const{overwrite:a=!1,importSettings:e=!1,importStorage:s=!1}=r,o={imported:0,skipped:0,errors:[],settingsImported:!1,storageImported:0};if(!t.scripts||!Array.isArray(t.scripts))return{error:"Invalid import format"};let c=(await O.getAll()).length;for(const u of t.scripts)try{const d=Ye(u.code);if(d.error){o.errors.push({name:u.id,error:d.error});continue}const f=await O.get(u.id);if(f&&!a){o.skipped++;continue}const h=e&&u.settings&&typeof u.settings=="object"?{...u.settings}:{...f?.settings||{}};if(await O.set(u.id,{id:u.id,code:u.code,meta:d.meta,enabled:u.enabled??!0,settings:h,position:u.position??c++,createdAt:u.createdAt||Date.now(),updatedAt:u.updatedAt||Date.now()}),s){const y=u.storage&&typeof u.storage=="object"?u.storage:{};Object.keys(y).length>0?(await Me.deleteAll(u.id),await Me.setAll(u.id,y),o.storageImported++):f&&await Me.deleteAll(u.id)}o.imported++}catch(d){o.errors.push({name:u.id,error:d.message})}return t.settings&&e&&(await H.set(t.settings),o.settingsImported=!0),await tt(),o}async function _a(t={}){const{includeStorage:r=!0}=t,a=await O.getAll(),e={},s=new Set;for(const f of a){let h=(f.meta.name||"unnamed").replace(/[<>:"/\\|?*]/g,"_").replace(/\s+/g," ").trim().substring(0,100);if(s.has(h)){let x=2;for(;s.has(`${h}_${x}`);)x++;h=`${h}_${x}`}s.add(h),e[`${h}.user.js`]=Ie.strToU8(f.code);const y={settings:{enabled:f.enabled,"run-at":f.meta["run-at"]||"document-idle",override:{use_includes:[],use_matches:[],use_excludes:[],use_connects:[],merge_includes:!0,merge_matches:!0,merge_excludes:!0,merge_connects:!0}},meta:{name:f.meta.name,namespace:f.meta.namespace||"",version:f.meta.version||"1.0",description:f.meta.description||"",author:f.meta.author||"",match:f.meta.match||[],include:f.meta.include||[],exclude:f.meta.exclude||[],grant:f.meta.grant||[],require:f.meta.require||[],resource:f.meta.resource||{}}};e[`${h}.options.json`]=Ie.strToU8(JSON.stringify(y,null,2));const _=r?await Me.getAll(f.id):null;if(_&&Object.keys(_).length>0){const x={data:_};e[`${h}.storage.json`]=Ie.strToU8(JSON.stringify(x,null,2))}}const o=Ie.zipSync(e,{level:6});let c="";const u=8192;for(let f=0;f<o.length;f+=u)c+=String.fromCharCode.apply(null,o.subarray(f,f+u));return{zipData:btoa(c),filename:`scriptvault-archive-${new Date().toISOString().replace(/[:.]/g,"-")}.zip`}}async function ra(t,r={}){const a={imported:0,skipped:0,errors:[]};try{let e;if(typeof t=="string"){const f=atob(t);e=new Uint8Array(f.length);for(let h=0;h<f.length;h++)e[h]=f.charCodeAt(h)}else t instanceof ArrayBuffer?e=new Uint8Array(t):e=t;const s=Ie.unzipSync(e),o=Object.keys(s),c=o.filter(f=>f.endsWith(".user.js")),u=await O.getAll();let d=u.length;for(const f of c)try{const h=Ie.strFromU8(s[f]);if(!h.includes("==UserScript==")){a.errors.push({name:f,error:"Not a valid userscript"});continue}const y=Ye(h);if(y.error){a.errors.push({name:f,error:y.error});continue}const _=u.find(z=>z.meta.name===y.meta.name&&(z.meta.namespace===y.meta.namespace||!z.meta.namespace&&!y.meta.namespace));if(_&&!r.overwrite){a.skipped++;continue}const x=f.replace(".user.js",""),E=s[`${x}.options.json`],P=s[`${x}.storage.json`];let A=!0,X={};if(E)try{A=JSON.parse(Ie.strFromU8(E)).settings?.enabled!==!1}catch(z){console.warn("Failed to parse options file:",z)}if(P)try{const z=JSON.parse(Ie.strFromU8(P));X=z.data||z||{}}catch(z){console.warn("Failed to parse storage file:",z)}const Q=_?.id||st(),ae={id:Q,code:h,meta:y.meta,enabled:A,position:_?.position??d++,createdAt:_?.createdAt||Date.now(),updatedAt:Date.now()};await O.set(Q,ae),Object.keys(X).length>0&&await Me.setAll(Q,X),a.imported++}catch(h){a.errors.push({name:f,error:h.message})}if(c.length===0){const f=o.filter(h=>h.endsWith(".js")&&!h.includes("/"));for(const h of f)try{const y=Ie.strFromU8(s[h]);if(!y.includes("==UserScript=="))continue;const _=Ye(y);if(_.error)continue;const x=st();await O.set(x,{id:x,code:y,meta:_.meta,enabled:!0,position:d++,createdAt:Date.now(),updatedAt:Date.now()}),a.imported++}catch(y){a.errors.push({name:h,error:y.message})}}return await Be(),await tt(),a}catch(e){return console.error("[ScriptVault] importFromZip error:",e),{...a,error:e.message}}}chrome.runtime.onMessage.addListener((t,r,a)=>(aa(t,r).then(a).catch(e=>{console.error("[ScriptVault] Unhandled message error:",e),a({error:e.message})}),!0));chrome.runtime.onUserScriptMessage&&(chrome.runtime.onUserScriptMessage.addListener((t,r,a)=>(aa(t,r).then(a).catch(e=>{console.error("[ScriptVault] Unhandled user script message error:",e),a({error:e.message})}),!0)),xe("User script message listener registered"));async function aa(t,r){const{action:a}=t,e=t.data||t;try{switch(a){case"getScripts":return{scripts:(await O.getAll()).map(o=>({...o,metadata:o.meta}))};case"getScript":{const s=await O.get(e.id);return s?{...s,metadata:s.meta}:null}case"saveScript":{if(e.code&&e.code.length>yt)return{error:`Script too large (${wt(e.code.length)}). Maximum is ${wt(yt)}.`};const s=Ye(e.code);if(s.error)return{error:s.error};const o=e.id||e.scriptId||st(),c=await O.get(o),u={...c?.settings||{}};delete u.mergeConflict,e.markModified&&(u.userModified=!0);const d={...c,id:o,code:e.code,meta:s.meta,enabled:e.enabled!==void 0?e.enabled:c?.enabled??!0,settings:u,position:c?.position??(await O.getAll()).length,createdAt:c?.createdAt||Date.now(),updatedAt:Date.now()};await O.set(o,d),await Be(),await sa(d);try{if((await chrome.storage.local.get("liveReloadScripts")).liveReloadScripts?.[o]){const y=await chrome.tabs.query({});for(const _ of y)if(_.url&&qt(d,_.url))try{chrome.tabs.reload(_.id)}catch{}}}catch{}await It(o),d.enabled!==!1&&await ft(d);const f=await H.get();return!c&&f.notifyOnInstall&&chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Script Installed",message:`${d.meta.name} v${d.meta.version}`}),{success:!0,scriptId:o,script:{...d,metadata:d.meta}}}case"createScript":{const s=Ye(e.code);if(s.error)return{error:s.error};const o=st(),c={id:o,code:e.code,meta:s.meta,enabled:!0,position:(await O.getAll()).length,createdAt:Date.now(),updatedAt:Date.now()};return await O.set(o,c),await Be(),await ft(c),(await H.get()).notifyOnInstall&&chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Script Created",message:`${c.meta.name} v${c.meta.version}`}),{success:!0,scriptId:o,script:{...c,metadata:c.meta}}}case"deleteScript":{const s=e.id||e.scriptId;if(!s)return{error:"No script ID provided"};const o=await O.get(s);if(!o)return{error:"Script not found"};if(((await H.get()).trashMode||"30")!=="disabled"){const y=(await chrome.storage.local.get("trash")).trash||[];y.push({...o,trashedAt:Date.now()}),await chrome.storage.local.set({trash:y})}await It(s),await O.delete(s);try{const h=await chrome.storage.session.get("menuCommands");h?.menuCommands?.[s]&&(delete h.menuCommands[s],await chrome.storage.session.set(h))}catch{}const f=(await chrome.storage.local.get("syncTombstones")).syncTombstones||{};return f[s]=Date.now(),await chrome.storage.local.set({syncTombstones:f}),await Be(),{success:!0,scriptId:s,scriptName:o.meta?.name||s}}case"getTrash":{const o=(await chrome.storage.local.get("trash")).trash||[],u=(await H.get()).trashMode||"30",d=u==="1"?864e5:u==="7"?6048e5:u==="30"?2592e6:0,f=Date.now(),h=d>0?o.filter(y=>f-y.trashedAt<d):o;return h.length!==o.length&&await chrome.storage.local.set({trash:h}),{trash:h}}case"restoreFromTrash":{const s=e.scriptId,c=(await chrome.storage.local.get("trash")).trash||[],u=c.findIndex(f=>f.id===s);if(u===-1)return{error:"Not found in trash"};const d=c[u];return delete d.trashedAt,c.splice(u,1),await chrome.storage.local.set({trash:c}),await O.set(d.id,d),d.enabled!==!1&&await ft(d),await Be(),{success:!0}}case"emptyTrash":return await chrome.storage.local.set({trash:[]}),{success:!0};case"restart":return chrome.runtime.reload(),{success:!0};case"permanentlyDelete":{const s=e.scriptId,u=((await chrome.storage.local.get("trash")).trash||[]).filter(d=>d.id!==s);return await chrome.storage.local.set({trash:u}),{success:!0}}case"toggleScript":{const s=e.id||e.scriptId;self._toggleLocks||(self._toggleLocks=new Map);const c=(self._toggleLocks.get(s)||Promise.resolve()).then(async()=>{const u=await O.get(s);if(!u)return{error:"Script not found"};u.enabled=e.enabled!==void 0?!!e.enabled:!u.enabled,u.updatedAt=Date.now(),await O.set(s,u),await It(s),u.enabled&&await ft(u),await Be();try{const d=await chrome.tabs.query({});for(const f of d)f.url&&qt(u,f.url)&&chrome.tabs.reload(f.id)}catch(d){xe("Toggle reload failed:",d.message)}return{success:!0,script:{id:u.id,enabled:u.enabled}}}).catch(u=>(xe("Toggle error:",u),{error:u?.message||"Failed to update script"})).finally(()=>{self._toggleLocks.get(s)===c&&self._toggleLocks.delete(s)});return self._toggleLocks.set(s,c),await c}case"importScript":{const s=Ye(e.code);if(s.error)return{error:s.error};const o=st(),c={id:o,code:e.code,meta:s.meta,enabled:!0,position:(await O.getAll()).length,createdAt:Date.now(),updatedAt:Date.now()};return await O.set(o,c),await ft(c),await Be(),{success:!0,script:{...c,metadata:c.meta}}}case"duplicateScript":{const s=await O.duplicate(e.id);return s?(await ft(s),await Be(),{success:!0,script:{...s,metadata:s.meta}}):{error:"Script not found"}}case"searchScripts":return{scripts:(await O.search(e.query)).map(o=>({...o,metadata:o.meta}))};case"reorderScripts":return await O.reorder(e.orderedIds),{success:!0};case"GM_getValue":return await Me.get(e.scriptId,e.key,e.defaultValue);case"GM_setValue":return await Me.set(e.scriptId,e.key,e.value);case"GM_deleteValue":case"deleteScriptValue":return await Me.delete(e.scriptId,e.key),{success:!0};case"GM_listValues":return await Me.list(e.scriptId);case"GM_getValues":return await Me.getAll(e.scriptId);case"GM_setValues":return await Me.setAll(e.scriptId,e.values),{success:!0};case"GM_deleteValues":return await Me.deleteMultiple(e.scriptId,e.keys),{success:!0};case"getScriptStorage":case"getScriptValues":return{values:await Me.getAll(e.scriptId)};case"setScriptStorage":return await Me.setAll(e.scriptId,e.values),{success:!0};case"getStorageSize":return await Me.getStorageSize(e.scriptId);case"GM_getTab":return or.get(r.tab?.id);case"GM_saveTab":return or.set(r.tab?.id,e.data),{success:!0};case"GM_getTabs":return or.getAll();case"prefetchResources":return await Vt.prefetchResources(e.resources),{success:!0};case"getSettings":return{settings:await H.get()};case"getExtensionStatus":{const s=await H.get(),o=s._chromeVersion||Wt(),c=s._userScriptsAvailable!==!1&&!!chrome.userScripts;let u=!1,d="";return c||(u=!0,o>=138?d='Enable "Allow User Scripts" for ScriptVault in chrome://extensions':o>=120?d="Enable Developer Mode in chrome://extensions to run userscripts":d="Chrome 120 or newer is required"),{userScriptsAvailable:c,setupRequired:u,setupMessage:d,chromeVersion:o}}case"repairRuntimeState":try{await oa(),await dr(),await tt(),await Be(),await xr();const s=await H.get(),o=s._chromeVersion||Wt(),c=s._userScriptsAvailable!==!1&&!!chrome.userScripts;let u=!1,d="";return c||(u=!0,o>=138?d='Enable "Allow User Scripts" for ScriptVault in chrome://extensions':o>=120?d="Enable Developer Mode in chrome://extensions to run userscripts":d="Chrome 120 or newer is required"),{success:!0,userScriptsAvailable:c,setupRequired:u,setupMessage:d,chromeVersion:o}}catch(s){return{success:!1,error:s?.message||"Runtime repair failed"}}case"getSetting":return await H.get(e.key);case"setSettings":{const s=await H.get(),o=await H.set(e.settings),c=e.settings;return"enabled"in c&&c.enabled!==s.enabled&&await tt(),("checkInterval"in c||"autoUpdate"in c||"syncEnabled"in c||"syncProvider"in c||"syncInterval"in c)&&await xr(),("badgeColor"in c||"badgeInfo"in c||"showBadge"in c)&&await Be(),"enableContextMenu"in c&&await dr(),("pageFilterMode"in c||"whitelistedPages"in c||"blacklistedPages"in c||"deniedHosts"in c)&&await tt(),o}case"resetSettings":return await H.reset();case"checkUpdates":return await ir.checkForUpdates(e?.scriptId);case"forceUpdate":{const s=e.scriptId,o=await O.get(s);if(!o)return{error:"Script not found"};const c=o.meta.downloadURL||o.meta.updateURL;if(!c)return{error:"No download URL configured"};try{const u=await fetch(c,{cache:"no-store",headers:{"Cache-Control":"no-cache",Pragma:"no-cache"}});if(!u.ok)return{error:`HTTP ${u.status}`};const d=await u.text(),f=Ye(d);return f.error?f:await ir.applyUpdate(s,d)}catch(u){return{error:u.message}}}case"applyUpdate":return await ir.applyUpdate(e.scriptId,e.code);case"getVersionHistory":return{history:(await O.get(e.scriptId))?.versionHistory||[]};case"rollbackScript":{const s=await O.get(e.scriptId);if(!s)return{error:"Script not found"};if(!s.versionHistory||s.versionHistory.length===0)return{error:"No version history available"};const o=e.index!==void 0?e.index:s.versionHistory.length-1,c=s.versionHistory[o];if(!c)return{error:"Version not found"};const u=Ye(c.code);return u.error?u:(s.versionHistory.push({version:s.meta.version,code:s.code,updatedAt:s.updatedAt||Date.now()}),s.versionHistory.splice(o,1),s.versionHistory.length>5&&(s.versionHistory=s.versionHistory.slice(-5)),s.code=c.code,s.meta=u.meta,s.updatedAt=Date.now(),await O.set(e.scriptId,s),await It(e.scriptId),s.enabled!==!1&&await ft(s),{success:!0,script:{...s,metadata:s.meta}})}case"sync":return await cr.sync();case"testSync":{const s=await H.get(),o=cr.providers[s.syncProvider];return o?await o.test(s):!1}case"connectSyncProvider":{const s=e.provider,o=mt[s];if(!o)return{success:!1,error:"Unknown provider"};try{const c=await H.get(),u=await o.connect(c);if(u.success){const d={};if(s==="googledrive")d.googleDriveConnected=!0,d.googleDriveUser=u.user;else if(s==="dropbox"){d.dropboxToken=u.token,d.dropboxRefreshToken=u.refreshToken||"",u.user&&(d.dropboxUser=u.user);const f=await o.getStatus({dropboxToken:u.token});f.user&&(d.dropboxUser=f.user)}d.syncProvider=s,await H.set(d)}return u}catch(c){return{success:!1,error:c.message}}}case"disconnectSyncProvider":{const s=e.provider,o=mt[s];if(!o)return{success:!1,error:"Unknown provider"};try{const c=await H.get();await o.disconnect(c);const u={syncProvider:"none"};return s==="googledrive"?(u.googleDriveConnected=!1,u.googleDriveUser=null):s==="dropbox"?(u.dropboxToken="",u.dropboxRefreshToken="",u.dropboxUser=null):s==="onedrive"&&(u.onedriveToken="",u.onedriveRefreshToken="",u.onedriveConnected=!1,u.onedriveUser=null),await H.set(u),{success:!0}}catch(c){return{success:!1,error:c.message}}}case"getSyncProviderStatus":{const s=e.provider,o=mt[s];if(!o)return{connected:!1};const c=await H.get();return o.getStatus?await o.getStatus(c):{connected:!1}}case"syncNow":return await cr.sync();case"cloudExport":{const s=e.provider,o=mt[s];if(!o)return{success:!1,error:"Unknown provider: "+s};try{const c=e?.includeSettings!==!1,u=e?.includeStorage!==!1,d=await Qr({includeSettings:c,includeStorage:u}),f=await H.get();return await o.upload(d,f),{success:!0,exported:d.scripts?.length||0,settingsIncluded:c,storageIncluded:u}}catch(c){return{success:!1,error:c.message}}}case"cloudImport":{const s=e.provider,o=mt[s];if(!o)return{success:!1,error:"Unknown provider: "+s};try{const c=await H.get(),u=await o.download(c);if(!u)return{success:!1,error:"No backup found on "+s};const d=await Zr(u,{overwrite:!0,importSettings:e?.importSettings===!0,importStorage:e?.importStorage!==!1});return{success:!d.error,...d}}catch(c){return{success:!1,error:c.message}}}case"cloudStatus":{const s=e.provider,o=mt[s];if(!o)return{connected:!1};try{const c=await H.get();return o.getStatus?await o.getStatus(c):{connected:!1}}catch(c){return{connected:!1,error:c.message}}}case"getAllScriptsValues":{const s=await O.getAll(),o={};for(const c of s){const u=await Me.getAll(c.id);u&&Object.keys(u).length>0&&(o[c.id]={scriptName:c.meta?.name||"Unknown Script",values:u})}return{allValues:o}}case"setScriptValue":return await Me.set(e.scriptId,e.key,e.value),{success:!0};case"deleteScriptValue":return await Me.delete(e.scriptId,e.key),{success:!0};case"clearScriptStorage":return await Me.deleteAll(e.scriptId),{success:!0};case"renameScriptValue":{const{scriptId:s,oldKey:o,newKey:c}=e;if(!s||!o||!c||o===c)return{error:"Invalid rename parameters"};const u=await Me.get(s,o);return u===void 0?{error:"Key not found"}:(await Me.set(s,c,u),await Me.delete(s,o),{success:!0})}case"getScriptSettings":{const s=await O.get(e.scriptId);return s?{settings:s.settings||{}}:{error:"Script not found"}}case"setScriptSettings":{const s=await O.get(e.scriptId);if(!s)return{error:"Script not found"};const o=s.settings||{},c=s.enabled;if(s.settings={...o,...e.settings},s.updatedAt=Date.now(),"enabled"in e.settings&&(s.enabled=!!e.settings.enabled),await O.set(e.scriptId,s),"enabled"in e.settings&&s.enabled!==c){await It(e.scriptId),s.enabled&&await ft(s),await Be();try{const f=await chrome.tabs.query({});for(const h of f)h.url&&qt(s,h.url)&&chrome.tabs.reload(h.id)}catch{}return{success:!0}}return["runAt","injectInto","useOriginalMatches","useOriginalIncludes","useOriginalExcludes","userMatches","userIncludes","userExcludes"].some(f=>JSON.stringify(o[f])!==JSON.stringify(e.settings[f]))&&s.enabled!==!1&&(await It(e.scriptId),await ft(s)),{success:!0}}case"exportAll":return await Qr(e?.options||{});case"importAll":return await Zr(e.data,e.options);case"importTampermonkeyBackup":{const s=e.text||"",o=[],c=s.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);for(const h of c){const y=h.trim();y.includes("==UserScript==")&&y.includes("==/UserScript==")&&o.push(y)}if(o.length===0)return{error:"No valid userscripts found in backup file"};const u={imported:0,skipped:0,errors:[]},d=await O.getAll();let f=d.length;for(const h of o)try{const y=Ye(h);if(y.error){u.errors.push({error:y.error});continue}const _=d.find(E=>E.meta.name===y.meta.name&&E.meta.namespace===y.meta.namespace);if(_&&!e.overwrite){u.skipped++;continue}const x=_?.id||st();await O.set(x,{id:x,code:h,meta:y.meta,enabled:!0,position:_?.position??f++,createdAt:_?.createdAt||Date.now(),updatedAt:Date.now()}),u.imported++}catch(y){u.errors.push({error:y.message})}return await tt(),await Be(),u}case"getStorageUsage":return typeof Tt<"u"?await Tt.getUsage():{bytesUsed:0,quota:10485760,percentage:0,level:"ok"};case"getStorageBreakdown":return typeof Tt<"u"?await Tt.getBreakdown():{};case"cleanupStorage":return typeof Tt<"u"?await Tt.cleanup(e.options||{}):{freedBytes:0,actions:[]};case"createBackup":return typeof ze<"u"?await ze.createBackup(e.reason||"manual"):{error:"BackupScheduler not available"};case"getBackups":return typeof ze<"u"?await ze.getBackups():{backups:[]};case"restoreBackup":return typeof ze<"u"?await ze.restoreBackup(e.backupId,e.options):{error:"BackupScheduler not available"};case"deleteBackup":return typeof ze<"u"?await ze.deleteBackup(e.backupId):{error:"BackupScheduler not available"};case"importBackup":return typeof ze<"u"?await ze.importBackup(e.zipData):{error:"BackupScheduler not available"};case"exportBackup":return typeof ze<"u"?await ze.exportBackup(e.backupId):{error:"BackupScheduler not available"};case"inspectBackup":return typeof ze<"u"?await ze.inspectBackup(e.backupId):{error:"BackupScheduler not available"};case"getBackupSettings":return typeof ze<"u"?ze.getSettings():{};case"setBackupSettings":return typeof ze<"u"?{success:!0,settings:await ze.setSettings(e.settings)}:{error:"BackupScheduler not available"};case"getProfiles":{const s=await chrome.storage.local.get(["profiles","activeProfileId"]);return{profiles:s.profiles||[],activeProfileId:s.activeProfileId||null}}case"switchProfile":{const c=((await chrome.storage.local.get("profiles")).profiles||[]).find(d=>d.id===e.profileId);if(!c)return{error:"Profile not found"};const u=await O.getAll();for(const d of u){const f=c.scriptStates?.[d.id]??d.enabled;d.enabled!==f&&(d.enabled=f,await O.set(d.id,d))}return await chrome.storage.local.set({activeProfileId:e.profileId}),await tt(),await Be(),{success:!0}}case"saveProfile":{const o=(await chrome.storage.local.get("profiles")).profiles||[],c=o.findIndex(u=>u.id===e.profile.id);return c>=0?o[c]=e.profile:o.push(e.profile),await chrome.storage.local.set({profiles:o}),{success:!0}}case"deleteProfile":{const s=await chrome.storage.local.get(["profiles","activeProfileId"]),c={profiles:(s.profiles||[]).filter(u=>u.id!==e.profileId)};return s.activeProfileId===e.profileId&&(c.activeProfileId=null),await chrome.storage.local.set(c),{success:!0}}case"getCollections":return{collections:(await chrome.storage.local.get("scriptCollections")).scriptCollections||[]};case"saveCollection":{const o=(await chrome.storage.local.get("scriptCollections")).scriptCollections||[],c=o.findIndex(u=>u.id===e.collection.id);return c>=0?o[c]=e.collection:o.push(e.collection),await chrome.storage.local.set({scriptCollections:o}),{success:!0}}case"deleteCollection":{const o=((await chrome.storage.local.get("scriptCollections")).scriptCollections||[]).filter(c=>c.id!==e.collectionId);return await chrome.storage.local.set({scriptCollections:o}),{success:!0}}case"reportCSPFailure":{const o=(await chrome.storage.local.get("cspReports")).cspReports||[];return o.push({url:e.url,scriptId:e.scriptId,directive:e.directive,timestamp:Date.now()}),o.length>500&&o.splice(0,o.length-500),await chrome.storage.local.set({cspReports:o}),{success:!0}}case"getCSPReports":return{reports:(await chrome.storage.local.get("cspReports")).cspReports||[]};case"getGistSettings":return(await chrome.storage.local.get("gistSettings")).gistSettings||{};case"saveGistSettings":return await chrome.storage.local.set({gistSettings:e.settings}),{success:!0};case"importViolentmonkeyBackup":{const s=e.text||"",o={imported:0,skipped:0,errors:[]};try{const f=JSON.parse(s);if(f.scripts&&Array.isArray(f.scripts)){const h=await O.getAll();let y=h.length;for(const _ of f.scripts)try{const x=_.code||_.custom?.code||"";if(!x){o.skipped++;continue}const E=Ye(x);if(E.error){o.errors.push({name:_.props?.name,error:E.error});continue}const P=h.find(X=>X.meta.name===E.meta.name&&X.meta.namespace===E.meta.namespace);if(P&&!e.overwrite){o.skipped++;continue}const A=P?.id||st();await O.set(A,{id:A,code:x,meta:E.meta,enabled:_.config?.enabled!==!1,position:P?.position??y++,createdAt:P?.createdAt||Date.now(),updatedAt:Date.now()}),o.imported++}catch(x){o.errors.push({error:x.message})}return await tt(),await Be(),o}}catch{}const c=await O.getAll();let u=c.length;const d=s.split(/\n\s*\n(?=\/\/\s*==UserScript==)/);for(const f of d){const h=f.trim();if(h.includes("==UserScript==")&&h.includes("==/UserScript=="))try{const y=Ye(h);if(y.error){o.errors.push({error:y.error});continue}const _=c.find(E=>E.meta.name===y.meta.name&&E.meta.namespace===y.meta.namespace);if(_&&!e.overwrite){o.skipped++;continue}const x=_?.id||st();await O.set(x,{id:x,code:h,meta:y.meta,enabled:!0,position:_?.position??u++,createdAt:_?.createdAt||Date.now(),updatedAt:Date.now()}),o.imported++}catch(y){o.errors.push({error:y.message})}}return await tt(),await Be(),o}case"importGreasemonkeyBackup":{const s=e.text||"",o={imported:0,skipped:0,errors:[]};try{const c=JSON.parse(s),u=Array.isArray(c)?c:c.scripts||[],d=await O.getAll();let f=d.length;for(const h of u)try{const y=h.source||h.code||h.content||"";if(!y){o.skipped++;continue}const _=Ye(y);if(_.error){o.errors.push({name:h.name,error:_.error});continue}const x=d.find(P=>P.meta.name===_.meta.name&&P.meta.namespace===_.meta.namespace);if(x&&!e.overwrite){o.skipped++;continue}const E=x?.id||st();await O.set(E,{id:E,code:y,meta:_.meta,enabled:h.enabled!==!1,position:x?.position??f++,createdAt:x?.createdAt||Date.now(),updatedAt:Date.now()}),o.imported++}catch(y){o.errors.push({error:y.message})}}catch(c){return{error:"Invalid Greasemonkey backup format: "+c.message}}return await tt(),await Be(),o}case"exportZip":return await _a(e?.options||{});case"getWorkspaces":return await Pt.getAll();case"createWorkspace":return{workspace:await Pt.create(e.name)};case"saveWorkspace":{const s=await Pt.save(e.id);return s?{success:!0,workspace:s}:{error:"Workspace not found"}}case"activateWorkspace":return await Pt.activate(e.id);case"updateWorkspace":return{workspace:await Pt.update(e.id,e.updates)};case"deleteWorkspace":{const s=await Pt.delete(e.id);return s?{success:!0,workspace:s}:{error:"Workspace not found"}}case"getNetworkLog":{const s=typeof e=="object"&&e?e:{},o=Ct.getAll(s),c=Ct.getStats();return o}case"getNetworkLogStats":return Ct.getStats();case"clearNetworkLog":return Ct.clear(e?.scriptId),{success:!0};case"netlog_record":return Ct.add({method:e.method||"GET",url:e.url||"",status:e.status,statusText:e.statusText,duration:e.duration,responseSize:e.responseSize,responseHeaders:e.responseHeaders,scriptId:e.scriptId,scriptName:e.scriptName,error:e.error,type:e.type||"fetch"}),{ok:!0};case"analyzeScript":{const s=e.code||"";return Rt.analyzeAsync(s)}case"signing_getPublicKey":return{publicKey:await _t.getPublicKeyJwk()};case"signing_sign":return e.code?_t.signAndEmbedInCode(e.code):{error:"No code provided"};case"signing_verify":return e.code?_t.verifyCodeSignature(e.code):{error:"No code provided"};case"signing_verifyRaw":return!e.code||!e.signatureInfo?{error:"Missing inputs"}:_t.verifyScript(e.code,e.signatureInfo);case"signing_trustKey":return e.publicKey?_t.trustKey(e.publicKey,e.name):{error:"No public key"};case"signing_untrustKey":return e.publicKey?_t.untrustKey(e.publicKey):{error:"No public key"};case"signing_getTrustedKeys":return{keys:await _t.getTrustedKeys()};case"publicApi_getTrustedOrigins":return typeof lt>"u"?{origins:[]}:{origins:lt.getTrustedOrigins()};case"publicApi_setTrustedOrigins":return typeof lt>"u"?{error:"Public API controls unavailable"}:(await lt.setTrustedOrigins(Array.isArray(e.origins)?e.origins:[]),{success:!0,origins:lt.getTrustedOrigins()});case"publicApi_getPermissions":return typeof lt>"u"?{permissions:{}}:{permissions:lt.getPermissions()};case"publicApi_getAuditLog":return typeof lt>"u"?{entries:[]}:{entries:lt.getAuditLog(e.limit||50)};case"publicApi_clearAuditLog":return typeof lt>"u"?{error:"Public API controls unavailable"}:(await lt.clearAuditLog(),{success:!0});case"signing_generateNewKeypair":return _t.generateAndStoreKeypair();case"getFolders":return{folders:await xt.getAll()};case"createFolder":return{folder:await xt.create(e.name,e.color)};case"updateFolder":return{folder:await xt.update(e.id,e.updates)};case"deleteFolder":return await xt.delete(e.id),{success:!0};case"addScriptToFolder":return await xt.addScript(e.folderId,e.scriptId),{success:!0};case"removeScriptFromFolder":return await xt.removeScript(e.folderId,e.scriptId),{success:!0};case"moveScriptToFolder":return await xt.moveScript(e.scriptId,e.fromFolderId,e.toFolderId),{success:!0};case"importFromZip":return await ra(e.zipData,e.options||{});case"installFromUrl":return await ka(e.url);case"fetchResource":return await Vt.fetchResource(e.url);case"GM_getResourceText":{const s=await O.get(e.scriptId);if(!s||!s.meta.resource)return null;const o=s.meta.resource[e.name];if(!o)return null;try{return await Vt.fetchResource(o)}catch{return null}}case"GM_getResourceURL":{const s=await O.get(e.scriptId);if(!s||!s.meta.resource)return null;const o=s.meta.resource[e.name];if(!o)return null;try{return await Vt.getDataUri(o)}catch{return null}}case"GM_loadScript":try{if(!e.url)return{error:"No URL provided"};if(e.scriptId){const d=await O.get(e.scriptId);if(d&&d.meta.connect&&d.meta.connect.length>0){const f=d.meta.connect;if(!f.includes("*"))try{const h=new URL(e.url).hostname;if(!f.some(_=>_==="self"?(d.meta.match||[]).map(E=>{try{return new URL(E.replace(/\*/g,"x")).hostname.replace(/^x\./,"")}catch{return null}}).filter(Boolean).some(E=>h===E||h.endsWith("."+E)):_==="localhost"?h==="localhost"||h==="127.0.0.1"||h==="::1":h===_||h.endsWith("."+_)))return{error:`Connection to ${h} blocked by @connect policy`}}catch{}}}const s=new AbortController,o=setTimeout(()=>s.abort(),e.timeout||3e4),c=await fetch(e.url,{signal:s.signal});if(clearTimeout(o),!c.ok)return{error:`HTTP ${c.status}`};const u=await c.text();return!u||u.length===0?{error:"Empty response"}:{code:u}}catch(s){return{error:s.message||"Fetch failed"}}case"GM_xmlhttpRequest":try{if(!e.url)return{error:"No URL provided",type:"error"};if(e.scriptId){const A=await O.get(e.scriptId);if(A&&A.meta.connect&&A.meta.connect.length>0){const X=A.meta.connect;if(!X.includes("*"))try{const z=new URL(e.url).hostname;if(!X.some(C=>C==="self"?(A.meta.match||[]).map(Y=>{try{return new URL(Y.replace(/\*/g,"x")).hostname.replace(/^x\./,"")}catch{return null}}).filter(Boolean).some(Y=>z===Y||z.endsWith("."+Y)):C==="localhost"?z==="localhost"||z==="127.0.0.1"||z==="::1":z===C||z.endsWith("."+C)))return console.warn(`[ScriptVault] @connect blocked: ${z} not in allowed list for ${A.meta.name}`),{error:`Connection to ${z} blocked by @connect policy`,type:"error"}}catch{return{error:"Invalid URL",type:"error"}}}}const s=r.tab?.id,o=kt.create(s,e.scriptId,e),{id:c}=o,u=Date.now(),d={scriptId:e.scriptId,scriptName:"",method:(e.method||"GET").toUpperCase(),url:e.url,requestSize:e.data&&typeof e.data=="string"?e.data.length:0};try{const A=await O.get(e.scriptId);d.scriptName=A?.meta?.name||e.scriptId}catch{}const f=new AbortController;o.controller=f;const h=(A,X={})=>{if(!(o.aborted&&A!=="abort"))try{chrome.tabs.sendMessage(s,{action:"xhrEvent",data:{requestId:c,scriptId:e.scriptId,type:A,...X}}).catch(()=>{})}catch{}},y=(e.method||"GET").toUpperCase(),_={method:y,headers:e.headers||{},signal:f.signal,credentials:e.anonymous?"omit":"include"};e.data&&y!=="GET"&&y!=="HEAD"&&(_.body=e.data);const x=await H.get(),E=e.timeout||x.xhrTimeout||3e4,P=setTimeout(()=>{o.aborted||(o.aborted=!0,f.abort(),h("timeout",{readyState:4,status:0,statusText:"",error:"Request timed out"}),h("loadend",{readyState:4}),kt.remove(c))},E);return h("loadstart",{readyState:1,status:0,lengthComputable:!1,loaded:0,total:0}),(async()=>{try{const A=await fetch(e.url,_);if(clearTimeout(P),o.aborted)return;const X=[...A.headers.entries()].map(([C,W])=>`${C}: ${W}`).join(`\r
`);h("readystatechange",{readyState:2,status:A.status,statusText:A.statusText,responseHeaders:X,finalUrl:A.url});const Q=parseInt(A.headers.get("content-length")||"0",10);let ae,z="";if(e.responseType==="arraybuffer"){const C=await A.arrayBuffer(),W=new Uint8Array(C);let Y="";for(let N=0;N<W.length;N+=32768)Y+=String.fromCharCode.apply(null,W.subarray(N,N+32768));ae={__sv_base64__:!0,data:btoa(Y)},h("progress",{readyState:3,lengthComputable:Q>0,loaded:C.byteLength,total:Q||C.byteLength})}else if(e.responseType==="blob"){const C=await A.blob();ae=await new Promise(W=>{const Y=new FileReader;Y.onload=()=>W(Y.result),Y.onerror=()=>W(null),Y.readAsDataURL(C)}),h("progress",{readyState:3,lengthComputable:Q>0,loaded:C.size,total:Q||C.size})}else if(e.responseType==="json"){z=await A.text();try{ae=JSON.parse(z)}catch{ae=z}h("progress",{readyState:3,lengthComputable:Q>0,loaded:z.length,total:Q||z.length})}else if(e.responseType==="stream"){const C=A.body?.getReader();if(C){let W=0;const Y=[],N=new TextDecoder;try{for(;;){const{done:B,value:pe}=await C.read();if(B||o.aborted)break;W+=pe.byteLength;const ve=N.decode(pe,{stream:!0});Y.push(ve),h("progress",{readyState:3,lengthComputable:Q>0,loaded:W,total:Q||0,responseText:ve,streamChunk:!0})}}finally{C.releaseLock()}z=Y.join(""),ae=z}else z=await A.text(),ae=z;h("progress",{readyState:3,lengthComputable:Q>0,loaded:z.length,total:Q||z.length})}else z=await A.text(),ae=z,h("progress",{readyState:3,lengthComputable:Q>0,loaded:z.length,total:Q||z.length});if(o.aborted)return;const V={readyState:4,status:A.status,statusText:A.statusText,responseHeaders:X,response:ae,responseText:z||(typeof ae=="string"?ae:JSON.stringify(ae)),finalUrl:A.url,lengthComputable:!0,loaded:z?.length||0,total:z?.length||0};h("load",V),Ct.add({...d,status:V.status,statusText:V.statusText,responseSize:z?.length||0,duration:Date.now()-u,finalUrl:V.finalUrl}),h("loadend",V),kt.remove(c)}catch(A){if(clearTimeout(P),o.aborted)return;const X=A.name==="AbortError",Q=X?"abort":"error",ae=X?"Request aborted":A.message||"Network error";Ct.add({...d,status:0,error:ae,duration:Date.now()-u}),h(Q,{readyState:4,status:0,statusText:"",error:ae}),h("loadend",{readyState:4,status:0}),kt.remove(c)}})().catch(A=>{console.error("[ScriptVault] Unexpected XHR handler error:",A),kt.remove(c)}),{requestId:c,started:!0}}catch(s){return console.error("[ScriptVault] GM_xmlhttpRequest setup error:",s),{error:s.message||"Request setup failed",type:"error"}}case"GM_xmlhttpRequest_abort":{const s=kt.get(e.requestId);return s&&!s.aborted?(s.aborted=!0,s.controller&&s.controller.abort(),kt.remove(e.requestId),{success:!0}):{success:!1}}case"GM_download":try{const s={url:e.url,filename:e.name,saveAs:e.saveAs||!1,conflictAction:e.conflictAction||"uniquify"},o=await chrome.downloads.download(s),c=r.tab?.id;if(c&&e.hasCallbacks){const u=(_,x={})=>{chrome.tabs.sendMessage(c,{action:"downloadEvent",data:{downloadId:o,scriptId:e.scriptId,type:_,...x}}).catch(()=>{})};let d=null,f=null;const h=()=>{chrome.downloads.onChanged.removeListener(y),d&&clearTimeout(d),f&&clearTimeout(f)},y=_=>{_.id===o&&(_.state&&(_.state.current==="complete"?(u("load",{url:e.url}),h()):_.state.current==="interrupted"&&(u("error",{error:_.error?.current||"Download interrupted"}),h())),_.bytesReceived&&u("progress",{loaded:_.bytesReceived.current,total:_.totalBytes?.current||0}))};chrome.downloads.onChanged.addListener(y),e.timeout&&(d=setTimeout(()=>{chrome.downloads.cancel(o).catch(()=>{}),u("timeout"),h()},e.timeout)),f=setTimeout(h,3e5)}return{success:!0,downloadId:o}}catch(s){return{error:s.message}}case"GM_notification":{const s={type:"basic",iconUrl:e.image||"images/icon128.png",title:e.title||"ScriptVault",message:e.text||"",silent:e.silent||!1},o=e.tag?await chrome.notifications.create(e.tag,s):await chrome.notifications.create(s),c=r.tab?.id;if(c&&(e.hasOnclick||e.hasOndone)&&(self._notifCallbacks||(self._notifCallbacks=new Map),self._notifCallbacks.set(o,{tabId:c,scriptId:e.scriptId,hasOnclick:e.hasOnclick,hasOndone:e.hasOndone})),e.timeout&&e.timeout>0)if(e.timeout>=3e4){const u=`notif_clear_${o}`;chrome.alarms.create(u,{delayInMinutes:e.timeout/6e4})}else setTimeout(()=>{chrome.notifications.clear(o).catch(()=>{}),self._notifCallbacks&&self._notifCallbacks.delete(o)},e.timeout);return{success:!0,id:o}}case"GM_openInTab":{const s={url:e.url,active:e.active!==void 0?e.active:!e.background};e.insert&&r.tab?.index!==void 0&&(s.index=r.tab.index+1),e.setParent&&r.tab?.id&&(s.openerTabId=r.tab.id);const o=await chrome.tabs.create(s),c=r.tab?.id;return c&&e.trackClose&&(self._openTabTrackers||(self._openTabTrackers=new Map),self._openTabTrackers.set(o.id,{callerTabId:c,scriptId:e.scriptId})),{success:!0,tabId:o.id}}case"GM_focusTab":return r.tab?.id&&await chrome.tabs.update(r.tab.id,{active:!0}),{success:!0};case"GM_closeTab":if(e.tabId)try{await chrome.tabs.remove(e.tabId)}catch{}return{success:!0};case"getScriptsForUrl":{const s=await O.getAll(),o=await H.get(),c=e.url||e;return na(c,o)?[]:s.filter(d=>qt(d,c)).sort((d,f)=>(d.position||0)-(f.position||0)).map(({code:d,...f})=>({...f,metadata:f.meta}))}case"updateBadgeForTab":return e.tabId&&e.url&&await Bt(e.tabId,e.url),{success:!0};case"getExtensionInfo":return{name:"ScriptVault",version:chrome.runtime.getManifest().version,scriptHandler:"ScriptVault",scriptMetaStr:null};case"registerMenuCommand":case"GM_registerMenuCommand":{const s=await chrome.storage.session.get("menuCommands")||{};s.menuCommands||(s.menuCommands={}),s.menuCommands[e.scriptId]||(s.menuCommands[e.scriptId]=[]);const o=s.menuCommands[e.scriptId].findIndex(u=>u.id===e.commandId),c={id:e.commandId,caption:e.caption,accessKey:e.accessKey||"",autoClose:e.autoClose!==!1,title:e.title||""};return o>=0?s.menuCommands[e.scriptId][o]=c:s.menuCommands[e.scriptId].push(c),await chrome.storage.session.set(s),{success:!0}}case"unregisterMenuCommand":case"GM_unregisterMenuCommand":{const s=await chrome.storage.session.get("menuCommands")||{};return s.menuCommands?.[e.scriptId]&&(s.menuCommands[e.scriptId]=s.menuCommands[e.scriptId].filter(o=>o.id!==e.commandId),s.menuCommands[e.scriptId].length===0&&delete s.menuCommands[e.scriptId],await chrome.storage.session.set(s)),{success:!0}}case"getMenuCommands":{const o=(await chrome.storage.session.get("menuCommands"))?.menuCommands||{},c=[],u=await O.getAll();for(const[d,f]of Object.entries(o)){const h=u.find(y=>y.id===d);h&&f&&f.forEach(y=>{c.push({...y,scriptId:d,scriptName:h.meta?.name||"Unknown Script"})})}return{commands:c}}case"executeMenuCommand":return r.tab?.id&&await chrome.tabs.sendMessage(r.tab.id,{action:"executeMenuCommand",data:{scriptId:e.scriptId,commandId:e.commandId}}),{success:!0};case"GM_cookie_list":try{const s={};return e.url&&(s.url=e.url),e.domain&&(s.domain=e.domain),e.name&&(s.name=e.name),e.path&&(s.path=e.path),{success:!0,cookies:await chrome.cookies.getAll(s)}}catch(s){return{error:s.message}}case"GM_cookie_set":try{return e.url?e.name?{success:!0,cookie:await chrome.cookies.set({url:e.url,name:e.name,value:e.value||"",domain:e.domain,path:e.path||"/",secure:e.secure||!1,httpOnly:e.httpOnly||!1,expirationDate:e.expirationDate,sameSite:e.sameSite||"unspecified"})}:{error:"name is required for cookie set"}:{error:"url is required for cookie set"}}catch(s){return{error:s.message}}case"GM_cookie_delete":try{return!e.url||!e.name?{error:"url and name are required for cookie delete"}:(await chrome.cookies.remove({url:e.url,name:e.name}),{success:!0})}catch(s){return{error:s.message}}case"GM_webRequest":{const s=r.userScriptId||e.scriptId;if(!s)return{error:"No script context"};if(!(await O.get(s))?.meta?.grant?.includes("GM_webRequest"))return{error:"Not granted"};const c=Array.isArray(e.rules)?e.rules:e.rules?[e.rules]:[];return await ia(s,c),{success:!0,count:c.length}}case"getScriptStats":{const s=e.scriptId;if(s)return{stats:(await O.get(s))?.stats||null};const o=await O.getAll(),c={};for(const u of o)u.stats&&(c[u.id]=u.stats);return{allStats:c}}case"resetScriptStats":{const s=e.scriptId,o=await O.get(s);return o&&(o.stats={runs:0,totalTime:0,avgTime:0,lastRun:0,errors:0},await O.set(s,o)),{success:!0}}case"reportExecTime":{const s=e.scriptId,o=await O.get(s);return o&&(o.stats||(o.stats={runs:0,totalTime:0,avgTime:0,lastRun:0,errors:0}),o.stats.runs++,o.stats.totalTime+=e.time,o.stats.avgTime=Math.round(o.stats.totalTime/o.stats.runs*100)/100,o.stats.lastRun=Date.now(),o.stats.lastUrl=e.url,ta()),{success:!0}}case"reportExecError":{const s=e.scriptId,o=await O.get(s);return o&&(o.stats||(o.stats={runs:0,totalTime:0,avgTime:0,lastRun:0,errors:0}),o.stats.errors++,o.stats.lastError=e.error,o.stats.lastErrorTime=Date.now(),ta()),{success:!0}}case"GM_audio_setMute":try{const s=r.tab?.id;if(!s)return{error:"No tab context"};const o=typeof e.mute=="object"?e.mute.mute:!!e.mute;return await chrome.tabs.update(s,{muted:o}),{success:!0}}catch(s){return{error:s.message}}case"GM_audio_getState":try{const s=r.tab?.id;if(!s)return{error:"No tab context"};const o=await chrome.tabs.get(s);return{muted:o.mutedInfo?.muted||!1,reason:o.mutedInfo?.reason||"user",audible:o.audible||!1}}catch(s){return{error:s.message}}case"GM_audio_watchState":{const s=r.tab?.id;return s?(self._audioWatchedTabs||(self._audioWatchedTabs=new Set),self._audioWatchedTabs.add(s),{success:!0}):{error:"No tab context"}}case"GM_audio_unwatchState":{const s=r.tab?.id;return s&&self._audioWatchedTabs&&self._audioWatchedTabs.delete(s),{success:!0}}case"npmResolve":return typeof Zt<"u"?await Zt.resolve(e.spec):{error:"NpmResolver not available"};case"npmResolveAll":return typeof Zt<"u"?await Zt.resolveAll(e.requires):{error:"NpmResolver not available"};case"logError":return typeof Xe<"u"?(await Xe.log(e.entry||e),{success:!0}):{error:"ErrorLog not available"};case"getErrorLog":return typeof Xe<"u"?await Xe.getAll(e.filters):{log:[]};case"getErrorLogGrouped":return typeof Xe<"u"?await Xe.getGrouped():{groups:[]};case"exportErrorLog":{if(typeof Xe<"u"){const s=e.format||"json";return s==="csv"?{data:await Xe.exportCSV()}:s==="text"?{data:await Xe.exportText()}:{data:await Xe.exportJSON()}}return{error:"ErrorLog not available"}}case"clearErrorLog":return typeof Xe<"u"?(await Xe.clear(),{success:!0}):{error:"ErrorLog not available"};case"getNotificationPrefs":return typeof At<"u"?await At.getPreferences():{};case"setNotificationPrefs":return typeof At<"u"?(await At.setPreferences(e.prefs),{success:!0}):{error:"NotificationSystem not available"};case"generateDigest":return typeof At<"u"?await At.generateDigest():{error:"NotificationSystem not available"};case"easyCloudConnect":return typeof et<"u"?await et.connect():{error:"EasyCloudSync not available"};case"easyCloudDisconnect":return typeof et<"u"?await et.disconnect():{error:"EasyCloudSync not available"};case"easyCloudSync":return typeof et<"u"?await et.sync():{error:"EasyCloudSync not available"};case"easyCloudStatus":return typeof et<"u"?await et.getStatus():{connected:!1};case"scriptConsoleCapture":{const s=`console_${e.scriptId}`,c=(await chrome.storage.session.get(s))[s]||[],u=(e.entries||[]).slice(-200);c.push(...u);const d=c.slice(-200);return await chrome.storage.session.set({[s]:d}),{success:!0}}case"getScriptConsole":return{entries:(await chrome.storage.session.get(`console_${e.scriptId}`))[`console_${e.scriptId}`]||[]};case"clearScriptConsole":return await chrome.storage.session.remove(`console_${e.scriptId}`),{success:!0};case"setLiveReload":{const o=(await chrome.storage.local.get("liveReloadScripts")).liveReloadScripts||{};return e.enabled?o[e.scriptId]=!0:delete o[e.scriptId],await chrome.storage.local.set({liveReloadScripts:o}),{success:!0}}case"getLiveReloadScripts":return{scripts:(await chrome.storage.local.get("liveReloadScripts")).liveReloadScripts||{}};default:return{error:"Unknown action: "+a}}}catch(s){if(console.error("[ScriptVault] Message handler error:",s),typeof Xe<"u")try{Xe.log({timestamp:Date.now(),error:s.message,stack:s.stack,context:"handleMessage",action:a})}catch{}return{error:s.message}}}let er=null,Mr=[];async function sa(t){(await H.get()).autoReload&&(Mr.push(t),er&&clearTimeout(er),er=setTimeout(async()=>{const a=Mr;Mr=[],er=null;try{const e=await chrome.tabs.query({}),s=new Set;for(const o of e)s.has(o.id)||o.url&&a.some(c=>qt(c,o.url))&&(chrome.tabs.reload(o.id),s.add(o.id))}catch(e){console.error("[ScriptVault] Auto-reload failed:",e)}},500))}async function Be(t=null){const r=await H.get();if(!r.showBadge||r.enabled===!1){chrome.action.setBadgeText({text:"",tabId:t||void 0});return}if(t){try{const a=await chrome.tabs.get(t);a&&a.url&&await Bt(t,a.url,r)}catch{chrome.action.setBadgeText({text:"",tabId:t})}return}try{const[a,e]=await Promise.all([chrome.tabs.query({}),O.getAll()]);await Promise.allSettled(a.filter(s=>s.id&&s.url).map(s=>Bt(s.id,s.url,r,e)))}catch{chrome.action.setBadgeText({text:""})}}async function Bt(t,r,a,e){if(a||(a=await H.get()),!a.showBadge||a.enabled===!1){chrome.action.setBadgeText({text:"",tabId:t});return}if(!r||r.startsWith("chrome://")||r.startsWith("chrome-extension://")||r.startsWith("about:")){chrome.action.setBadgeText({text:"",tabId:t});return}try{if(na(r,a)){chrome.action.setBadgeText({text:"",tabId:t});return}e||(e=await O.getAll());const s=e.filter(u=>u.enabled&&qt(u,r)),o=a.badgeInfo||"running";let c="";if(o==="running")c=s.length>0?String(s.length):"";else if(o==="total"){const u=e.filter(d=>d.enabled).length;c=u>0?String(u):""}chrome.action.setBadgeText({text:c,tabId:t}),chrome.action.setBadgeBackgroundColor({color:a.badgeColor||"#22c55e",tabId:t})}catch(s){console.error("[ScriptVault] Failed to update badge:",s)}}function na(t,r){if(!t)return!1;try{const a=new URL(t),e=r.deniedHosts;if(e&&Array.isArray(e)){for(const o of e)if(o&&(a.hostname===o||a.hostname.endsWith("."+o)))return!0}const s=r.pageFilterMode||"blacklist";if(s==="whitelist"){const o=(r.whitelistedPages||"").split(`
`).map(c=>c.trim()).filter(Boolean);if(o.length>0&&!o.some(u=>ur(u,t,a)))return!0}else if(s==="blacklist"){const o=(r.blacklistedPages||"").split(`
`).map(c=>c.trim()).filter(Boolean);if(o.length>0&&o.some(u=>ur(u,t,a)))return!0}}catch{}return!1}function qt(t,r){const a=t.meta||{},e=t.settings||{};try{const s=new URL(r);let o=[],c=[],u=[];if(e.useOriginalMatches!==!1){const f=Array.isArray(a.match)?a.match:a.match?[a.match]:[];o.push(...f)}if(e.userMatches&&e.userMatches.length>0&&o.push(...e.userMatches),e.useOriginalIncludes!==!1){const f=Array.isArray(a.include)?a.include:a.include?[a.include]:[];c.push(...f)}if(e.userIncludes&&e.userIncludes.length>0&&c.push(...e.userIncludes),e.useOriginalExcludes!==!1){const f=Array.isArray(a.exclude)?a.exclude:a.exclude?[a.exclude]:[];u.push(...f)}e.userExcludes&&e.userExcludes.length>0&&u.push(...e.userExcludes);const d=Array.isArray(a.excludeMatch)?a.excludeMatch:a.excludeMatch?[a.excludeMatch]:[];for(const f of u)if(ur(f,r,s))return!1;for(const f of d)if(ea(f,r,s))return!1;for(const f of o)if(ea(f,r,s))return!0;for(const f of c)if(ur(f,r,s))return!0;return!1}catch{return!1}}function ea(t,r,a){if(!t)return!1;if(t==="<all_urls>"||t==="*")return!0;try{const e=t.match(/^(\*|https?|file|ftp):\/\/([^/]+)(\/.*)$/);if(!e)return!1;const[,s,o,c]=e;if(s!=="*"&&s!==a.protocol.slice(0,-1))return!1;if(o!=="*"){const d=o.includes(":"),f=d?a.host:a.hostname;if(o.startsWith("*.")){const h=o.slice(2);if(d){if(f!==h&&!f.endsWith("."+h))return!1}else if(a.hostname!==h&&!a.hostname.endsWith("."+h))return!1}else if(o!==f)return!1}return!!new RegExp("^"+c.replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*")+"$").test(a.pathname+a.search)}catch{return!1}}function ur(t,r,a){if(!t)return!1;if(t==="*")return!0;try{if(Ir(t)){const o=Da(t);return o?o.test(r):!1}let e=t.replace(/\*{2,}/g,"*").replace(/[.+^${}()|[\]\\]/g,"\\$&").replace(/\*/g,".*").replace(/\?/g,".");return e=e.replace(/^(\\\*):\/\//,"(https?|file|ftp)://"),new RegExp("^"+e+"$","i").test(r)}catch{return!1}}async function dr(){if(await chrome.contextMenus.removeAll(),(await H.get()).enableContextMenu===!1)return;chrome.contextMenus.create({id:"scriptvault-new",title:"Create script for this site",contexts:["page"]}),chrome.contextMenus.create({id:"scriptvault-dashboard",title:"Open ScriptVault Dashboard",contexts:["page"]}),chrome.contextMenus.create({id:"scriptvault-toggle",title:"Toggle all scripts",contexts:["page"]}),chrome.contextMenus.create({id:"scriptvault-install-link",title:"Install userscript from link",contexts:["link"],targetUrlPatterns:["*://*/*.user.js","*://*/*.user.js?*"]});const a=(await O.getAll()).filter(e=>e.enabled!==!1&&e.meta&&e.meta["run-at"]==="context-menu");if(a.length>0){chrome.contextMenus.create({id:"scriptvault-separator",type:"separator",contexts:["page","selection","link","image"]});for(const e of a)chrome.contextMenus.create({id:`scriptvault-ctx-${e.id}`,title:e.meta.name||e.id,contexts:["page","selection","link","image"]})}}chrome.runtime.onInstalled.addListener(async t=>{if(dr(),typeof ze<"u")try{await ze.init()}catch(r){console.error("[ScriptVault] BackupScheduler init error:",r)}if(typeof At<"u")try{await At.scheduleDigest()}catch(r){console.error("[ScriptVault] Digest schedule error:",r)}if(typeof lt<"u")try{lt.init()}catch(r){console.error("[ScriptVault] PublicAPI init error:",r)}});chrome.contextMenus.onClicked.addListener(async(t,r)=>{switch(t.menuItemId){case"scriptvault-new":{if(!r?.url)break;try{const a=new URL(r.url);chrome.tabs.create({url:`pages/dashboard.html?new=1&host=${encodeURIComponent(a.hostname)}`})}catch{chrome.tabs.create({url:"pages/dashboard.html?new=1"})}break}case"scriptvault-dashboard":chrome.tabs.create({url:"pages/dashboard.html"});break;case"scriptvault-toggle":{const a=await H.get();await H.set("enabled",!a.enabled),await tt(),await Be();break}case"scriptvault-install-link":{const a=t.linkUrl;if(a)try{const e=await fetch(a);if(!e.ok)throw new Error(`HTTP ${e.status}`);const s=await e.text();s.includes("==UserScript==")?(await chrome.storage.local.set({pendingInstall:{code:s,url:a,timestamp:Date.now()}}),chrome.tabs.create({url:chrome.runtime.getURL("pages/install.html")})):chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Not a Userscript",message:"The linked file does not contain a valid ==UserScript== block."})}catch(e){chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Install Failed",message:`Could not fetch script: ${e.message}`})}break}default:{if(t.menuItemId&&typeof t.menuItemId=="string"&&t.menuItemId.startsWith("scriptvault-ctx-")){const a=t.menuItemId.replace("scriptvault-ctx-",""),e=await O.get(a);if(e&&r?.id)try{const s=e.meta,o=Array.isArray(s.require)?s.require:s.require?[s.require]:[],c=[];for(const h of o)try{const y=await Ur(h);y&&c.push({url:h,code:y})}catch{}const u=await Me.getAll(e.id)||{},d=la(e,c,u,[],[]);await chrome.scripting.executeScript({target:{tabId:r.id},func:h=>{(0,eval)(h)},args:[d]}),(await H.get()).notifyOnError!==!1&&chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Script Executed",message:`${e.meta.name} ran via context menu`})}catch(s){console.error("[ScriptVault] Context-menu script execution failed:",s),chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"Script Failed",message:`${e.meta.name}: ${s.message||"Unknown error"}`})}}break}}});chrome.commands.onCommand.addListener(async t=>{switch(t){case"open_dashboard":chrome.tabs.create({url:"pages/dashboard.html"});break;case"toggle_scripts":{const r=await H.get();await H.set("enabled",!r.enabled),await tt(),await Be(),chrome.notifications.create({type:"basic",iconUrl:"images/icon128.png",title:"ScriptVault",message:r.enabled?"Scripts disabled":"Scripts enabled"});break}}});let tr=null;function ta(){tr&&clearTimeout(tr),tr=setTimeout(()=>{tr=null,O.save().catch(()=>{})},5e3)}let rr=!1;chrome.alarms.onAlarm.addListener(async t=>{if(t.name.startsWith("notif_clear_")){const a=t.name.slice(12);chrome.notifications.clear(a).catch(()=>{}),self._notifCallbacks&&self._notifCallbacks.delete(a);return}if(t.name.startsWith("notifCtx_clean_")){const a=t.name.slice(15);chrome.storage.local.remove(`notifCtx_${a}`).catch(()=>{});return}if(rr){xe("Skipping alarm",t.name,"- another task is running");return}rr=!0;const r=setTimeout(()=>{rr=!1},3e5);try{t.name==="autoUpdate"?await ir.autoUpdate():t.name==="autoSync"&&await cr.sync()}catch(a){console.error("[ScriptVault] Alarm handler error:",a)}finally{clearTimeout(r),rr=!1}});async function xr(){const t=await H.get();if(await chrome.alarms.clear("autoUpdate").catch(()=>{}),await chrome.alarms.clear("autoSync").catch(()=>{}),t.autoUpdate){const r=t.checkInterval?parseInt(t.checkInterval)*36e5:t.updateInterval||864e5;chrome.alarms.create("autoUpdate",{periodInMinutes:Math.max(1,r/6e4)})}if(t.syncEnabled&&t.syncProvider!=="none"){const r=t.syncInterval||36e5;chrome.alarms.create("autoSync",{periodInMinutes:Math.max(1,r/6e4)})}}chrome.tabs.onActivated.addListener(async t=>{try{const r=await chrome.tabs.get(t.tabId);r.url&&await Bt(t.tabId,r.url)}catch{}});chrome.tabs.onUpdated.addListener(async(t,r,a)=>{if((r.url||r.status==="complete")&&a.url&&await Bt(t,a.url),("audible"in r||"mutedInfo"in r)&&self._audioWatchedTabs?.has(t))try{await chrome.tabs.sendMessage(t,{action:"audioStateChanged",data:{muted:a.mutedInfo?.muted||!1,reason:a.mutedInfo?.reason||"user",audible:a.audible||!1}})}catch{self._audioWatchedTabs.delete(t)}});chrome.tabs.onRemoved.addListener(t=>{const r=self._openTabTrackers?.get(t);r&&(chrome.tabs.sendMessage(r.callerTabId,{action:"openedTabClosed",data:{tabId:t,scriptId:r.scriptId}}).catch(()=>{}),self._openTabTrackers.delete(t)),self._audioWatchedTabs&&self._audioWatchedTabs.delete(t)});chrome.notifications.onClicked.addListener(t=>{const r=self._notifCallbacks?.get(t);r&&r.hasOnclick&&chrome.tabs.sendMessage(r.tabId,{action:"notificationEvent",data:{notifId:t,scriptId:r.scriptId,type:"click"}}).catch(()=>{})});chrome.notifications.onClosed.addListener((t,r)=>{const a=self._notifCallbacks?.get(t);a&&a.hasOndone&&chrome.tabs.sendMessage(a.tabId,{action:"notificationEvent",data:{notifId:t,scriptId:a.scriptId,type:"done",byUser:r}}).catch(()=>{}),self._notifCallbacks&&self._notifCallbacks.delete(t)});chrome.windows.onFocusChanged.addListener(async t=>{if(t!==chrome.windows.WINDOW_ID_NONE)try{const[r]=await chrome.tabs.query({active:!0,windowId:t});r?.id&&r.url&&await Bt(r.id,r.url)}catch{}});const ar=new Set,yt=5*1024*1024;chrome.webNavigation.onBeforeNavigate.addListener(async t=>{if(t.frameId!==0)return;const r=t.url;if(r.match(/\.user\.js(\?.*)?$/i)&&!r.startsWith("chrome-extension://")&&!ar.has(r)){ar.add(r),xe("Intercepting userscript URL:",r);try{const a=new AbortController,e=setTimeout(()=>a.abort(),3e4),s=await fetch(r,{signal:a.signal});if(clearTimeout(e),!s.ok)throw new Error(`HTTP ${s.status}: ${s.statusText}`);const o=parseInt(s.headers.get("content-length")||"0",10);if(o>yt)throw new Error(`Script too large (${wt(o)}). Maximum is ${wt(yt)}.`);const c=await s.text();if(c.length>yt)throw new Error(`Script too large (${wt(c.length)}). Maximum is ${wt(yt)}.`);if(!c.includes("==UserScript==")){xe("Not a valid userscript, allowing normal navigation"),ar.delete(r),await chrome.storage.local.remove("pendingInstall");return}await chrome.storage.local.set({pendingInstall:{url:r,code:c,timestamp:Date.now()}}),chrome.tabs.update(t.tabId,{url:chrome.runtime.getURL("pages/install.html")})}catch(a){console.error("[ScriptVault] Failed to fetch script:",a),await chrome.storage.local.set({pendingInstall:{url:r,error:a.message,timestamp:Date.now()}}),chrome.tabs.update(t.tabId,{url:chrome.runtime.getURL("pages/install.html")})}finally{ar.delete(r)}}},{url:[{urlMatches:".*\\.user\\.js(\\?.*)?$"}]});async function ka(t){try{const r=new AbortController,a=setTimeout(()=>r.abort(),3e4),e=await fetch(t,{signal:r.signal});if(clearTimeout(a),!e.ok)throw new Error(`HTTP ${e.status}`);const s=parseInt(e.headers.get("content-length")||"0",10);if(s>yt)throw new Error(`Script too large (${wt(s)}). Maximum is ${wt(yt)}.`);const o=await e.text();if(o.length>yt)throw new Error(`Script too large (${wt(o.length)}). Maximum is ${wt(yt)}.`);if(!o.includes("==UserScript=="))throw new Error("Not a valid userscript");const c=Ye(o);if(c.error)throw new Error(c.error);const u=c.meta,d=await O.getAll(),f=d.find(_=>_.meta.name===u.name&&_.meta.namespace===u.namespace),h=f?f.id:st(),y={id:h,code:o,meta:u,enabled:f?f.enabled:!0,position:f?f.position:d.length,createdAt:f?f.createdAt:Date.now(),updatedAt:Date.now()};return await O.set(h,y),await tt(),await Be(),await sa(y),{success:!0,script:y}}catch(r){return{success:!1,error:r.message}}}async function Aa(){await H.init(),await O.init();const t=await H.get();if(t.language&&t.language!=="default"&&t.language!=="auto"&&Rr.setLocale(t.language),await oa(),await dr(),await tt(),await Be(),await xr(),Ta(),typeof Xr<"u")try{await Xr.run()}catch(r){console.error("[ScriptVault] Migration error:",r)}if(typeof Tt<"u")try{await Tt.autoCleanup()}catch(r){console.error("[ScriptVault] Quota cleanup error:",r)}typeof Xe<"u"&&typeof Xe.registerGlobalHandlers=="function"&&Xe.registerGlobalHandlers(),console.log("[ScriptVault] Service worker ready")}async function Ta(){try{const t=await chrome.storage.local.get(null),r=Date.now(),a=10080*60*1e3,e=Vt.maxAge,s=[];for(const[o,c]of Object.entries(t))o.startsWith("require_cache_")&&c?.timestamp?r-c.timestamp>a&&s.push(o):o.startsWith("res_cache_")&&c?.timestamp&&r-c.timestamp>e&&s.push(o);s.length>0&&(await chrome.storage.local.remove(s),xe(`Cleaned up ${s.length} stale cache entries`))}catch{}try{const r=(await chrome.storage.local.get("syncTombstones")).syncTombstones||{},a=Date.now()-720*60*60*1e3,e=Object.fromEntries(Object.entries(r).filter(([,s])=>s>a));Object.keys(e).length!==Object.keys(r).length&&await chrome.storage.local.set({syncTombstones:e})}catch{}try{const r=(await H.get()).trashMode||"30";if(r==="disabled")return;const a=r==="1"?864e5:r==="7"?6048e5:2592e6,s=(await chrome.storage.local.get("trash")).trash||[],o=Date.now(),c=s.filter(u=>o-u.trashedAt<a);c.length!==s.length&&(await chrome.storage.local.set({trash:c}),xe(`Pruned ${s.length-c.length} expired trash entries`))}catch{}}function Wt(){try{const t=(self.navigator?.userAgent||"").match(/Chrome\/(\d+)/);return t?parseInt(t[1],10):0}catch{return 0}}async function oa(){try{if(!chrome.userScripts){const t=Wt();t>=138?console.warn('[ScriptVault] userScripts API not available \u2014 enable the "Allow User Scripts" toggle in chrome://extensions for ScriptVault'):t>=120?console.warn("[ScriptVault] userScripts API not available \u2014 enable Developer Mode in chrome://extensions"):console.warn("[ScriptVault] userScripts API not available \u2014 Chrome 120+ required"),await H.set({_userScriptsAvailable:!1,_chromeVersion:t});return}await H.set({_userScriptsAvailable:!0,_chromeVersion:Wt()}),await chrome.userScripts.configureWorld({csp:"script-src 'self' 'unsafe-inline' 'unsafe-eval' *",messaging:!0}),xe("userScripts world configured (Chrome",Wt(),")")}catch(t){console.error("[ScriptVault] Failed to configure userScripts world:",t)}}async function tt(){try{if(!chrome.userScripts){console.warn("[ScriptVault] userScripts API not available");return}await chrome.userScripts.unregister().catch(()=>{});const t=await O.getAll();if(!(await H.get()).enabled){xe("Scripts globally disabled");return}const a=t.filter(c=>c.enabled!==!1);a.sort((c,u)=>{const d=c.meta?.priority||0,f=u.meta?.priority||0;return f!==d?f-d:(c.position||0)-(u.position||0)}),xe(`Registering ${a.length} scripts`);const e=new Set;for(const c of a)for(const u of c.meta?.require||[])e.add(u);if(e.size>0){xe(`Preloading ${e.size} @require dependencies`);const c=Date.now();await Promise.allSettled([...e].map(u=>Ur(u))),xe(`Preloaded in ${Date.now()-c}ms`)}const o=(await Promise.allSettled(a.map(c=>ft(c)))).filter(c=>c.status==="rejected");o.length>0&&console.warn(`[ScriptVault] ${o.length} script(s) failed to register:`,o.map(c=>c.reason?.message||c.reason))}catch(t){console.error("[ScriptVault] Failed to register scripts:",t)}}async function ft(t){try{if(!chrome.userScripts)return;const r=t.meta,a=t.settings||{},e=[],s=[];if(a.useOriginalMatches!==!1&&r.match&&Array.isArray(r.match))for(const N of r.match)at(N)&&e.push(N);if(a.userMatches&&Array.isArray(a.userMatches))for(const N of a.userMatches)if(at(N))e.push(N);else{const B=jt(N);B&&at(B)&&e.push(B)}const o=[],c=[];if(a.useOriginalIncludes!==!1&&r.include&&Array.isArray(r.include))for(const N of r.include)if(Ir(N)){o.push(N);const B=Ua(N);B.length>0&&e.push(...B)}else{const B=jt(N);B&&at(B)?e.push(B):N==="*"&&e.push("<all_urls>")}if(a.userIncludes&&Array.isArray(a.userIncludes))for(const N of a.userIncludes){const B=jt(N);B&&at(B)?e.push(B):N==="*"&&e.push("<all_urls>")}if(r.excludeMatch&&Array.isArray(r.excludeMatch))for(const N of r.excludeMatch)at(N)&&s.push(N);if(a.useOriginalExcludes!==!1&&r.exclude&&Array.isArray(r.exclude))for(const N of r.exclude){if(Ir(N)){c.push(N);continue}const B=jt(N);B&&at(B)&&s.push(B)}if(a.userExcludes&&Array.isArray(a.userExcludes))for(const N of a.userExcludes){const B=jt(N);B&&at(B)&&s.push(B)}const u=await H.get(),d=u.deniedHosts;if(d&&Array.isArray(d))for(const N of d)N&&s.push(`*://${N}/*`,`*://*.${N}/*`);if(u.pageFilterMode==="blacklist"&&u.blacklistedPages){const N=u.blacklistedPages.split(`
`).map(B=>B.trim()).filter(Boolean);for(const B of N){const pe=jt(B);pe&&at(pe)&&s.push(pe)}}e.length===0&&e.push("<all_urls>");const f={"document-start":"document_start","document-end":"document_end","document-idle":"document_idle","document-body":"document_end","context-menu":"document_idle"},h=r["run-in"]||"";let y=r["run-at"];if(a.runAt&&a.runAt!=="default"&&(y=a.runAt),y==="context-menu"){xe(`Skipping auto-register for context-menu script: ${r.name}`);return}const x=f[y]||"document_idle",E="USER_SCRIPT",P=r["inject-into"]||"auto",A=r.sandbox||"",X=P==="page"||A==="raw",Q=[],ae=Array.isArray(r.require)?r.require:r.require?[r.require]:[],z=[];for(const N of ae)try{const B=await Ur(N);B?Q.push({url:N,code:B}):z.push(N)}catch(B){console.warn(`[ScriptVault] Failed to fetch @require ${N}:`,B.message),z.push(N)}z.length>0?(t.settings=t.settings||{},t.settings._failedRequires=z,await O.set(t.id,t),Sa(`${r.name}: ${z.length} @require dependency(s) failed to load`)):t.settings?._failedRequires&&(delete t.settings._failedRequires,await O.set(t.id,t)),await Vt.prefetchResources(r.resource);const V=await Me.getAll(t.id)||{};X&&xe(`Note: @inject-into page / @sandbox raw not fully supported in MV3, running in USER_SCRIPT world: ${r.name}`);const C=la(t,Q,V,o,c),W={id:t.id,matches:e,excludeMatches:s.length>0?s:void 0,js:[{code:C}],runAt:x,allFrames:!r.noframes,world:E};let Y=!1;try{await chrome.userScripts.configureWorld({worldId:t.id,csp:"script-src 'self' 'unsafe-inline' 'unsafe-eval' *",messaging:!0}),Y=!0}catch{}Y&&(W.worldId=t.id);try{await chrome.userScripts.register([{...W,messaging:E==="USER_SCRIPT"}])}catch(N){if(N.message?.includes("messaging"))await chrome.userScripts.register([W]);else throw N}if(xe(`Registered: ${r.name} (${ae.length} @require, ${Object.keys(V).length} stored values)`),r.webRequest){const N=Array.isArray(r.webRequest)?r.webRequest:[r.webRequest];await ia(t.id,N)}}catch(r){console.error(`[ScriptVault] Failed to register ${t.meta.name}:`,r);try{t.settings=t.settings||{},t.settings._registrationError=r.message||"Registration failed",await O.set(t.id,t)}catch{}}}const sr=new Map,nr={jquery:["https://code.jquery.com/jquery-3.7.1.min.js","https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js","https://ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js"],"jquery@3":["https://code.jquery.com/jquery-3.7.1.min.js","https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"],"jquery@2":["https://code.jquery.com/jquery-2.2.4.min.js","https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.4/jquery.min.js"],gm_config:["https://cdn.jsdelivr.net/npm/gm_config@2024.12.1/gm_config.min.js","https://cdn.jsdelivr.net/gh/sizzlemctwizzle/GM_config@master/gm_config.js","https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js","https://greasyfork.org/scripts/1884-gm-config/code/gm_config.js","https://openuserjs.org/src/libs/sizzle/GM_config.js"],"mutation-summary":["https://cdn.jsdelivr.net/npm/mutation-summary@1.0.1/dist/mutation-summary.min.js","https://cdnjs.cloudflare.com/ajax/libs/mutation-summary/1.0.1/mutation-summary.min.js","https://unpkg.com/mutation-summary@1.0.1/dist/mutation-summary.min.js"]};function Ea(t){const r=t.toLowerCase();if(r.includes("gm_config")||r.includes("gm-config")||r.includes("gm4_config")||r.includes("sizzle/gm_config")||r.includes("1884-gm-config"))return nr.gm_config;if(r.includes("mutation-summary")||r.includes("mutationsummary"))return nr["mutation-summary"];if(r.includes("jquery"))return r.includes("@2")||r.includes("2.")?nr["jquery@2"]:nr.jquery;if(r.includes("unpkg.com"))return[t.replace("unpkg.com","cdn.jsdelivr.net/npm")];if(r.includes("raw.githubusercontent.com")){const a=t.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)/);if(a){const[,e,s,o,c]=a;return[`https://cdn.jsdelivr.net/gh/${e}/${s}@${o}/${c}`]}}return[]}function Ma(t){const r=t.toLowerCase();return!!(r.includes("kit.fontawesome.com")||r.includes("fonts.googleapis.com")||r.includes("?token=")||r.includes("&token="))}async function xa(t,r){if(!r)return!0;const a=r.match(/^(sha256|sha384|sha512|md5)[-=](.+)$/i);if(!a)return!0;const[,e,s]=a;if(e.toLowerCase()==="md5")return!0;const o={sha256:"SHA-256",sha384:"SHA-384",sha512:"SHA-512"};try{const c=await crypto.subtle.digest(o[e.toLowerCase()],new TextEncoder().encode(t));return btoa(String.fromCharCode(...new Uint8Array(c)))===s}catch{return!0}}async function Ur(t){let r=null,a=t;const e=t.indexOf("#");if(e>0){const u=t.slice(e+1);/^(sha256|sha384|sha512|md5)[-=]/i.test(u)&&(r=u,a=t.slice(0,e))}if(xe("Fetching @require:",a),Ma(a))return console.warn(`[ScriptVault] Skipping unfetchable @require: ${t}`),null;if(sr.has(a))return xe("Using cached @require:",a),sr.get(a);const s=await(async()=>{const u=new TextEncoder().encode(t),d=await crypto.subtle.digest("SHA-256",u);return`require_cache_${Array.from(new Uint8Array(d)).map(h=>h.toString(16).padStart(2,"0")).join("")}`})();try{const u=await chrome.storage.local.get(s);if(u[s]?.code&&Date.now()-(u[s].timestamp||0)<10080*60*1e3)return xe("Using persistent cached @require:",t),sr.set(a,u[s].code),u[s].code}catch{}const o=Ea(a),c=[a,...o];xe(`Will try ${c.length} URLs for:`,a);for(const u of c)try{xe("Trying:",u);const d=await Ca(u);if(d){if(r&&!await xa(d,r)){console.warn(`[ScriptVault] SRI hash mismatch for ${u}, skipping`);continue}sr.set(a,d);try{await chrome.storage.local.set({[s]:{code:d,timestamp:Date.now(),url:u}})}catch{}return u!==t?xe(`Successfully fetched ${t} from fallback:`,u):xe("Successfully fetched:",t),d}}catch(d){console.warn(`[ScriptVault] Failed to fetch ${u}: ${d.message}`);continue}return console.error(`[ScriptVault] Failed to fetch ${t} (tried ${c.length} URLs)`),null}async function Ca(t,r=2){for(let a=0;a<=r;a++)try{const e=new AbortController,s=setTimeout(()=>e.abort(),1e4),o=await fetch(t,{method:"GET",headers:{Accept:"text/javascript, application/javascript, text/plain, */*","Cache-Control":"no-cache"},mode:"cors",credentials:"omit",signal:e.signal});if(clearTimeout(s),!o.ok)throw new Error(`HTTP ${o.status}`);const c=5*1024*1024,u=parseInt(o.headers.get("content-length")||"0",10);if(u>c)throw new Error(`Response too large (${Math.round(u/1024)}KB, max 5MB)`);const d=await o.text();if(d.length>c)throw new Error(`Response too large (${Math.round(d.length/1024)}KB, max 5MB)`);if(d&&d.length>0)return d;throw new Error("Empty response")}catch(e){if(a===r)throw e;await new Promise(s=>setTimeout(s,500*(a+1)))}return null}const Cr=new Map;function Ia(t,r){let a=0;for(let e=0;e<t.length;e++)a=a*31+t.charCodeAt(e)&2147483647;return((a&2097151)<<10|r&1023)+1}function Ra(t,r){const a={id:r,priority:t.priority||1,condition:{},action:{}},e=t.selector||{};if(e.url){const o=e.url;if(Array.isArray(o)){const c=o.find(d=>d.include);c&&(a.condition.urlFilter=c.include);const u=o.find(d=>d.exclude);u&&(a.condition.excludedInitiatorDomains=[u.exclude.replace(/\*/g,"")].filter(Boolean))}else typeof o=="string"&&(a.condition.urlFilter=o)}e.tab&&(a.condition.tabIds=Array.isArray(e.tab)?e.tab:[e.tab]),e.type&&(a.condition.resourceTypes=Array.isArray(e.type)?e.type:[e.type]);const s=t.action||{};if(s.cancel)a.action.type="block";else if(s.redirect)a.action.type="redirect",a.action.redirect=typeof s.redirect=="string"?{url:s.redirect}:{url:s.redirect.url||s.redirect.regexSubstitution||""};else if(s.setRequestHeaders)a.action.type="modifyHeaders",a.action.requestHeaders=Object.entries(s.setRequestHeaders).map(([o,c])=>c===null?{header:o,operation:"remove"}:{header:o,operation:"set",value:c});else if(s.setResponseHeaders)a.action.type="modifyHeaders",a.action.responseHeaders=Object.entries(s.setResponseHeaders).map(([o,c])=>c===null?{header:o,operation:"remove"}:{header:o,operation:"set",value:c});else return null;return a}async function ia(t,r){if(!(!chrome.declarativeNetRequest||!Array.isArray(r)||r.length===0))try{await ca(t);const a=[],e=[];if(r.forEach((s,o)=>{const c=Ia(t,o),u=Ra(s,c);u&&(a.push(u),e.push(c))}),a.length>0){const s=await chrome.declarativeNetRequest.getDynamicRules();if(s.length+a.length>3e4){console.warn(`[ScriptVault] DNR rule limit would be exceeded: ${s.length} + ${a.length} > 30000`);return}await chrome.declarativeNetRequest.updateDynamicRules({addRules:a}),Cr.set(t,e),xe(`[GM_webRequest] Applied ${a.length} rules for script ${t}`)}}catch(a){console.warn("[ScriptVault] GM_webRequest rule apply failed:",a.message)}}async function ca(t){if(!chrome.declarativeNetRequest)return;const r=Cr.get(t);if(r&&r.length>0){try{await chrome.declarativeNetRequest.updateDynamicRules({removeRuleIds:r})}catch{}Cr.delete(t)}}async function It(t){await ca(t);try{if(!chrome.userScripts)return;await chrome.userScripts.unregister({ids:[t]});try{await chrome.userScripts.resetWorldConfiguration({worldId:t})}catch{}}catch{}}function la(t,r=[],a={},e=[],s=[]){const o=t.meta,c=o.grant||["none"];let u="";for(const x of r){const E=x.url.replace(/\*\//g,"* /");u+=`
// @require ${E}
${x.code}
`}const d=u?`
  // Expose common @require libraries to window
  if (typeof GM_config !== 'undefined' && typeof window.GM_config === 'undefined') window.GM_config = GM_config;
  if (typeof GM_configStruct !== 'undefined' && typeof window.GM_configStruct === 'undefined') window.GM_configStruct = GM_configStruct;
  if (typeof $ !== 'undefined' && typeof window.$ === 'undefined') window.$ = $;
  if (typeof jQuery !== 'undefined' && typeof window.jQuery === 'undefined') window.jQuery = jQuery;
  if (typeof Fuse !== 'undefined' && typeof window.Fuse === 'undefined') window.Fuse = Fuse;
  if (typeof JSZip !== 'undefined' && typeof window.JSZip === 'undefined') window.JSZip = JSZip;
`:"",f=chrome.runtime.id,h=`
(function() {
  'use strict';
  
  // ============ Console Capture (v2.0) ============
  // Intercept console.log/warn/error for per-script debugging
  {
    const _origConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
    const _scriptId = ${JSON.stringify(t.id)};
    const _captureLimit = 200;
    let _captureBuffer = [];
    function _captureConsole(level, args) {
      try {
        _captureBuffer.push({ level, args: Array.from(args).map(a => { try { return typeof a === 'object' ? JSON.stringify(a).slice(0, 500) : String(a); } catch { return String(a); } }), timestamp: Date.now() });
        if (_captureBuffer.length > _captureLimit) _captureBuffer.shift();
        // Batch-send every 2 seconds
        if (!_captureConsole._timer) {
          _captureConsole._timer = setTimeout(() => {
            try { chrome.runtime.sendMessage({ action: 'scriptConsoleCapture', scriptId: _scriptId, entries: _captureBuffer.splice(0) }); } catch {}
            _captureConsole._timer = null;
          }, 2000);
        }
      } catch {}
    }
    console.log = function() { _captureConsole('log', arguments); return _origConsole.log.apply(console, arguments); };
    console.warn = function() { _captureConsole('warn', arguments); return _origConsole.warn.apply(console, arguments); };
    console.error = function() { _captureConsole('error', arguments); return _origConsole.error.apply(console, arguments); };
    console.info = function() { _captureConsole('info', arguments); return _origConsole.info.apply(console, arguments); };
    console.debug = function() { _captureConsole('debug', arguments); return _origConsole.debug.apply(console, arguments); };
  }
  // ============ End Console Capture ============

  // ============ Error Suppression ============
  // Suppress uncaught errors and unhandled rejections from userscripts
  // to prevent them from appearing on chrome://extensions error page.
  // Chrome captures any error/warn/log from USER_SCRIPT world, so we
  // must silently swallow these without any console output.
  window.addEventListener('error', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    // Report to error log
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(t.id)}, scriptName: ${JSON.stringify(o.name)}, error: event.message || 'Unknown error', url: location.href, line: event.lineno, col: event.colno, timestamp: Date.now() } }); } catch {}
    return true;
  }, true);
  window.addEventListener('unhandledrejection', function(event) {
    event.stopImmediatePropagation();
    event.preventDefault();
    try { chrome.runtime.sendMessage({ action: 'logError', entry: { scriptId: ${JSON.stringify(t.id)}, scriptName: ${JSON.stringify(o.name)}, error: event.reason?.message || String(event.reason) || 'Unhandled rejection', url: location.href, timestamp: Date.now() } }); } catch {}
  }, true);
  // ============ End Error Suppression ============

  ${o["run-in"]==="incognito-tabs"?`
  // ============ @run-in incognito-tabs Guard ============
  if (!chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
`:o["run-in"]==="normal-tabs"?`
  // ============ @run-in normal-tabs Guard ============
  if (chrome?.extension?.inIncognitoContext) return;
  // ============ End @run-in Guard ============
`:""}
  ${(()=>{const x=e.map(P=>{const A=P.match(/^\/(.+)\/([gimsuy]*)$/);return A?`new RegExp(${JSON.stringify(A[1])}, ${JSON.stringify(A[2])})`:null}).filter(Boolean),E=s.map(P=>{const A=P.match(/^\/(.+)\/([gimsuy]*)$/);return A?`new RegExp(${JSON.stringify(A[1])}, ${JSON.stringify(A[2])})`:null}).filter(Boolean);return x.length===0&&E.length===0?"":`
  // ============ Regex @include/@exclude URL Guard ============
  {
    const __url = location.href;
    ${x.length>0?`const __regexIncludes = [${x.join(", ")}];
    const __includeMatch = __regexIncludes.some(re => re.test(__url));
    if (!__includeMatch) return;`:""}
    ${E.length>0?`const __regexExcludes = [${E.join(", ")}];
    const __excludeMatch = __regexExcludes.some(re => re.test(__url));
    if (__excludeMatch) return;`:""}
  }
  // ============ End URL Guard ============
`})()}
  const scriptId = ${JSON.stringify(t.id)};
  const meta = ${JSON.stringify(o)};
  const grants = ${JSON.stringify(c)};
  const grantSet = new Set(grants);
  
  // Channel ID for communication with content script bridge
  // Extension ID is injected at build time since chrome.runtime isn't available in USER_SCRIPT world
  const CHANNEL_ID = ${JSON.stringify("ScriptVault_"+f)};
  
  // console.log('[ScriptVault] Script initializing:', meta.name, 'Channel:', CHANNEL_ID);
  
  // Grant checking - @grant none or empty grants means NO APIs except GM_info
  const hasNone = grantSet.has('none');
  const hasGrant = (n) => {
    if (hasNone || grants.length === 0) return false;
    return grantSet.has(n) || grantSet.has('*');
  };
  
  // GM_info - always available
  const GM_info = {
    script: {
      name: meta.name || 'Unknown',
      namespace: meta.namespace || '',
      description: meta.description || '',
      version: meta.version || '1.0',
      author: meta.author || '',
      homepage: meta.homepage || meta.homepageURL || '',
      icon: meta.icon || '',
      icon64: meta.icon64 || '',
      matches: meta.match || [],
      includes: meta.include || [],
      excludes: meta.exclude || [],
      excludeMatches: meta.excludeMatch || [],
      grants: grants,
      resources: meta.resource || {},
      requires: meta.require || [],
      runAt: meta['run-at'] || 'document-idle',
      connect: meta.connect || [],
      noframes: meta.noframes || false,
      unwrap: meta.unwrap || false,
      antifeatures: meta.antifeature || [],
      tags: meta.tag || [],
      license: meta.license || '',
      updateURL: meta.updateURL || '',
      downloadURL: meta.downloadURL || '',
      supportURL: meta.supportURL || ''
    },
    scriptMetaStr: ${JSON.stringify(t.code.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/)?.[0]||"")},
    scriptHandler: 'ScriptVault',
    scriptSource: 'ScriptVault',
    version: ${JSON.stringify(chrome.runtime.getManifest().version)},
    scriptWillUpdate: !!(meta.updateURL || meta.downloadURL),
    isIncognito: typeof chrome !== 'undefined' && chrome.extension ? chrome.extension.inIncognitoContext : false,
    downloadMode: 'browser',
    platform: {
      os: navigator.userAgentData?.platform || navigator.platform || 'unknown',
      arch: navigator.userAgentData?.architecture || 'unknown',
      browserName: 'Chrome',
      browserVersion: navigator.userAgent?.match(/Chrome\\/([\\d.]+)/)?.[1] || 'unknown'
    },
    uuid: ${JSON.stringify(t.id)}
  };
  
  // Storage cache - mutable so we can refresh it with fresh values from background
  // Pre-loaded values serve as fallback if background fetch fails
  let _cache = ${JSON.stringify(a)};
  let _cacheReady = false; // Track if we've fetched fresh values
  let _cacheReadyPromise = null;
  let _cacheReadyResolve = null;
  
  // XHR request tracking (like Violentmonkey's idMap)
  const _xhrRequests = new Map(); // requestId -> { details, aborted }
  let _xhrSeqId = 0;
  
  // Value change listeners (like Tampermonkey)
  const _valueChangeListeners = new Map(); // listenerId -> { key, callback }
  let _valueChangeListenerId = 0;
  
  // Listen for messages from content script (for menu commands, value changes, and XHR events)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
    
    // Handle menu command execution
    if (msg.type === 'menuCommand' && msg.scriptId === scriptId) {
      const cmd = _menuCmds.get(msg.commandId);
      if (cmd?.callback) try { cmd.callback(); } catch(err) { /* silently ignore menu command errors */ }
    }
    
    // Handle value change notifications (cross-tab sync)
    if (msg.type === 'valueChanged' && msg.scriptId === scriptId) {
      const oldValue = _cache[msg.key];
      if (msg.newValue === undefined) {
        delete _cache[msg.key];
      } else {
        _cache[msg.key] = msg.newValue;
      }
      // Notify value change listeners
      _valueChangeListeners.forEach((listener) => {
        if (listener.key === msg.key || listener.key === null) {
          try {
            listener.callback(msg.key, oldValue, msg.newValue, msg.remote !== false);
          } catch (e) {
            /* silently ignore value change listener errors */
          }
        }
      });
    }
    
    // Handle XHR events
    if (msg.type === 'xhrEvent' && msg.scriptId === scriptId) {
      const request = _xhrRequests.get(msg.requestId);
      if (!request || request.aborted) return;
      
      const { details } = request;
      const eventType = msg.eventType;
      const eventData = msg.data || {};
      
      // Decode binary responses transferred as base64/dataURL
      let responseValue = eventData.response;
      if (responseValue && typeof responseValue === 'object' && responseValue.__sv_base64__) {
        // arraybuffer: base64 -> ArrayBuffer
        const binary = atob(responseValue.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        responseValue = bytes.buffer;
      } else if (details.responseType === 'blob' && typeof responseValue === 'string' && responseValue.startsWith('data:')) {
        // blob: data URL -> Blob
        try {
          const [header, b64] = responseValue.split(',');
          const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          responseValue = new Blob([bytes], { type: mime });
        } catch (e) {
          // Fall through with data URL string if conversion fails
        }
      }

      // Build response object matching GM_xmlhttpRequest spec
      const response = {
        readyState: eventData.readyState || 0,
        status: eventData.status || 0,
        statusText: eventData.statusText || '',
        responseHeaders: eventData.responseHeaders || '',
        response: responseValue,
        responseText: eventData.responseText || '',
        responseXML: eventData.responseXML,
        finalUrl: eventData.finalUrl || details.url,
        context: details.context,
        lengthComputable: eventData.lengthComputable,
        loaded: eventData.loaded,
        total: eventData.total
      };
      
      // Call appropriate callback
      const callbackName = 'on' + eventType;
      if (eventType.startsWith('upload.')) {
        const uploadEvent = eventType.replace('upload.', '');
        if (details.upload && details.upload['on' + uploadEvent]) {
          try {
            details.upload['on' + uploadEvent](response);
          } catch (e) {
            /* silently ignore XHR upload callback errors */
          }
        }
      } else if (details[callbackName]) {
        try {
          details[callbackName](response);
        } catch (e) {
          /* silently ignore XHR callback errors */
        }
      }
      
      // Clean up on loadend
      if (eventType === 'loadend') {
        _xhrRequests.delete(msg.requestId);
      }
    }
  });
  
  // Bridge ready state tracking
  let _bridgeReady = false;
  let _bridgeReadyPromise = null;
  let _bridgeReadyResolve = null;
  
  // Wait for bridge to be ready
  function waitForBridge() {
    // Check if already ready (content script sets this global)
    if (window.__ScriptVault_BridgeReady__ || _bridgeReady) {
      _bridgeReady = true;
      return Promise.resolve();
    }
    
    // Return existing promise if already waiting
    if (_bridgeReadyPromise) return _bridgeReadyPromise;
    
    // Create promise to wait for bridge ready message
    _bridgeReadyPromise = new Promise((resolve) => {
      _bridgeReadyResolve = resolve;
      
      // Listen for bridgeReady message from content script
      function bridgeReadyHandler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.type === 'bridgeReady') {
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }
      window.addEventListener('message', bridgeReadyHandler);
      
      // Also check global flag periodically (fallback)
      const checkInterval = setInterval(() => {
        if (window.__ScriptVault_BridgeReady__) {
          clearInterval(checkInterval);
          window.removeEventListener('message', bridgeReadyHandler);
          _bridgeReady = true;
          resolve();
        }
      }, 10);
      
      // Timeout after 1 second - bridge should be ready much faster
      setTimeout(() => {
        clearInterval(checkInterval);
        window.removeEventListener('message', bridgeReadyHandler);
        if (!_bridgeReady) {
          // This is normal in some contexts, proceed without warning spam
          _bridgeReady = true;
          resolve();
        }
      }, 1000);
    });
    
    return _bridgeReadyPromise;
  }
  
  // Send message to background script
  // Prefers chrome.runtime.sendMessage (direct, no bridge needed) when available via messaging: true
  // Falls back to postMessage bridge for older Chrome versions
  async function sendToBackground(action, data) {
    // Try direct messaging first (available when userScripts world has messaging: true)
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        return await chrome.runtime.sendMessage({ action, data });
      } catch (e) {
        // Extension context invalidated or messaging not available, fall through to bridge
      }
    }

    // Fallback: use content script bridge via postMessage
    await waitForBridge();

    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(2) + Date.now().toString(36);

      // Set timeout for response
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(undefined);
      }, 10000);

      // Listen for response
      function handler(event) {
        if (event.source !== window) return;
        const msg = event.data;
        if (!msg || msg.channel !== CHANNEL_ID || msg.direction !== 'to-userscript') return;
        if (msg.id !== id) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);

        if (msg.success) {
          resolve(msg.result);
        } else {
          resolve(undefined);
        }
      }

      window.addEventListener('message', handler);

      // Send to content script bridge
      window.postMessage({
        channel: CHANNEL_ID,
        direction: 'to-background',
        id: id,
        action: action,
        data: data
      }, '*');
    });
  }

  // Refresh storage cache from background
  // This ensures we have the latest values, not stale values from registration time
  async function _refreshStorageCache() {
    if (_cacheReady) return;
    
    try {
      const freshValues = await sendToBackground('GM_getValues', { scriptId });
      if (freshValues && typeof freshValues === 'object') {
        // Merge fresh values with any local changes made before refresh completed
        _cache = { ..._cache, ...freshValues };
      }
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    } catch (e) {
      // If refresh fails, continue with pre-loaded values
      _cacheReady = true;
      if (_cacheReadyResolve) _cacheReadyResolve();
    }
  }
  
  // Start refreshing cache immediately (don't await - let script start running)
  // Scripts can use GM_getValue immediately with pre-loaded values
  // Fresh values will be available after the async refresh completes
  _refreshStorageCache();
  
  // Synchronous GM_getValue - returns from cache (pre-loaded or refreshed)
  function GM_getValue(key, defaultValue) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue')) return defaultValue;
    if (key in _cache) return _cache[key];
    return defaultValue;
  }
  
  // GM_setValue - updates cache IMMEDIATELY, persists async (like Tampermonkey/Violentmonkey)
  function GM_setValue(key, value) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue')) {
      return;
    }
    // Update local cache IMMEDIATELY - this makes subsequent GM_getValue instant
    _cache[key] = value;
    // Persist async (fire and forget) - background handles debouncing
    sendToBackground('GM_setValue', { scriptId, key, value }).catch(() => {});
    return value;
  }
  
  // GM_deleteValue
  function GM_deleteValue(key) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue')) return;
    delete _cache[key];
    sendToBackground('GM_deleteValue', { scriptId, key }).catch(() => {});
  }
  
  // GM_listValues - returns cached keys synchronously
  function GM_listValues() {
    if (!hasGrant('GM_listValues') && !hasGrant('GM.listValues')) return [];
    return Object.keys(_cache);
  }
  
  // GM_getValues - Get multiple values at once (like Violentmonkey)
  // Accepts array of keys or object with default values
  function GM_getValues(keysOrDefaults) {
    if (!hasGrant('GM_getValue') && !hasGrant('GM.getValue') && 
        !hasGrant('GM_getValues') && !hasGrant('GM.getValues')) {
      return Array.isArray(keysOrDefaults) ? {} : keysOrDefaults;
    }
    const result = {};
    if (Array.isArray(keysOrDefaults)) {
      // Array of keys - return values or undefined
      for (const key of keysOrDefaults) {
        if (key in _cache) {
          result[key] = _cache[key];
        }
      }
    } else if (typeof keysOrDefaults === 'object' && keysOrDefaults !== null) {
      // Object with defaults - return values or defaults
      for (const key of Object.keys(keysOrDefaults)) {
        result[key] = key in _cache ? _cache[key] : keysOrDefaults[key];
      }
    }
    return result;
  }
  
  // GM_setValues - Set multiple values at once (like Violentmonkey)
  function GM_setValues(values) {
    if (!hasGrant('GM_setValue') && !hasGrant('GM.setValue') &&
        !hasGrant('GM_setValues') && !hasGrant('GM.setValues')) {
      return;
    }
    if (typeof values !== 'object' || values === null) return;
    
    // Update local cache immediately for all values
    for (const [key, value] of Object.entries(values)) {
      _cache[key] = value;
    }
    // Persist all values to background in one call
    sendToBackground('GM_setValues', { scriptId, values }).catch(() => {});
  }
  
  // GM_deleteValues - Delete multiple values at once (like Violentmonkey)
  function GM_deleteValues(keys) {
    if (!hasGrant('GM_deleteValue') && !hasGrant('GM.deleteValue') &&
        !hasGrant('GM_deleteValues') && !hasGrant('GM.deleteValues')) {
      return;
    }
    if (!Array.isArray(keys)) return;
    
    // Delete from local cache immediately
    for (const key of keys) {
      delete _cache[key];
    }
    // Persist deletions to background in one call
    sendToBackground('GM_deleteValues', { scriptId, keys }).catch(() => {});
  }
  
  // GM_addStyle - inject CSS with robust DOM handling
  function GM_addStyle(css) {
    const style = document.createElement('style');
    style.textContent = css;
    style.setAttribute('data-scriptvault', scriptId);
    
    // Try to inject immediately
    function inject() {
      const target = document.head || document.documentElement || document.body;
      if (target && target.appendChild) {
        try {
          target.appendChild(style);
          return true;
        } catch (e) {
          // appendChild failed, will retry
        }
      }
      return false;
    }
    
    if (!inject()) {
      // DOM not ready - wait for it
      if (document.readyState === 'loading') {
        // Document still loading, wait for DOMContentLoaded
        document.addEventListener('DOMContentLoaded', () => inject(), { once: true });
      } else {
        // Document loaded but no valid target - use MutationObserver
        const observer = new MutationObserver(() => {
          if (inject()) {
            observer.disconnect();
          }
        });
        
        // Observe whatever root we can find
        const root = document.documentElement || document;
        if (root && root.nodeType === Node.ELEMENT_NODE) {
          observer.observe(root, { childList: true, subtree: true });
        }
        
        // Fallback timeout - try one more time after a delay
        setTimeout(() => {
          observer.disconnect();
          if (!style.parentNode) {
            inject();
          }
        }, 1000);
      }
    }
    
    return style;
  }
  
  // GM_xmlhttpRequest - Full implementation with all events (like Violentmonkey)
  function GM_xmlhttpRequest(details) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (details.onerror) details.onerror({ error: 'Permission denied', status: 0 });
      return { abort: () => {} };
    }
    
    // Generate unique request ID
    const localId = 'xhr_' + (++_xhrSeqId) + '_' + Date.now().toString(36);
    let requestId = null;
    let aborted = false;
    let currentMapKey = localId;

    // Store request details for event handling
    const requestEntry = { details, aborted: false };
    _xhrRequests.set(localId, requestEntry);

    // Control object returned to the script
    const control = {
      abort: () => {
        aborted = true;
        requestEntry.aborted = true;
        // Send abort using server ID if available, clean up both keys
        if (requestId) {
          sendToBackground('GM_xmlhttpRequest_abort', { requestId }).catch(() => {});
        }
        // Call onabort callback
        if (details.onabort) {
          try {
            details.onabort({ error: 'Aborted', status: 0 });
          } catch (e) {}
        }
        // Clean up both possible keys to avoid orphans
        _xhrRequests.delete(localId);
        if (requestId) _xhrRequests.delete(requestId);
      }
    };

    // Start the request
    sendToBackground('GM_xmlhttpRequest', {
      scriptId,
      method: details.method || 'GET',
      url: details.url,
      headers: details.headers,
      data: details.data,
      timeout: details.timeout,
      responseType: details.responseType,
      overrideMimeType: details.overrideMimeType,
      user: details.user,
      password: details.password,
      context: details.context,
      anonymous: details.anonymous,
      // Track which callbacks are registered so background knows what to send
      hasCallbacks: {
        onload: !!details.onload,
        onerror: !!details.onerror,
        onprogress: !!details.onprogress,
        onreadystatechange: !!details.onreadystatechange,
        ontimeout: !!details.ontimeout,
        onabort: !!details.onabort,
        onloadstart: !!details.onloadstart,
        onloadend: !!details.onloadend,
        upload: !!(details.upload && (
          details.upload.onprogress || 
          details.upload.onloadstart || 
          details.upload.onload || 
          details.upload.onerror
        ))
      }
    }).then(response => {
      if (aborted) return;
      
      if (!response) {
        // No response (bridge failure)
        if (details.onerror) details.onerror({ error: 'Request failed - no response', status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.error) {
        // Immediate error
        if (details.onerror) details.onerror({ error: response.error, status: 0 });
        _xhrRequests.delete(currentMapKey);
      } else if (response.requestId) {
        // Re-key: add server ID entry, then remove local ID
        requestId = response.requestId;
        _xhrRequests.set(requestId, requestEntry);
        _xhrRequests.delete(localId);
        currentMapKey = requestId;
      }
    }).catch(err => {
      if (aborted) return;
      if (details.onerror) details.onerror({ error: err.message || 'Request failed', status: 0 });
      _xhrRequests.delete(currentMapKey);
    });
    
    return control;
  }
  
  // GM_addValueChangeListener - Watch for value changes (like Tampermonkey)
  function GM_addValueChangeListener(key, callback) {
    if (!hasGrant('GM_addValueChangeListener') && !hasGrant('GM.addValueChangeListener')) return null;
    if (typeof callback !== 'function') return null;
    
    const listenerId = ++_valueChangeListenerId;
    _valueChangeListeners.set(listenerId, { key, callback });
    return listenerId;
  }
  
  // GM_removeValueChangeListener - Stop watching for value changes
  function GM_removeValueChangeListener(listenerId) {
    if (!hasGrant('GM_removeValueChangeListener') && !hasGrant('GM.removeValueChangeListener')) return false;
    return _valueChangeListeners.delete(listenerId);
  }
  
  // GM_setClipboard
  function GM_setClipboard(text, type) {
    if (!hasGrant('GM_setClipboard') && !hasGrant('GM.setClipboard')) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopyText(text));
    } else {
      fallbackCopyText(text);
    }
  }
  
  function fallbackCopyText(text) {
    const target = document.body || document.documentElement;
    if (!target) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    target.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch(e) {}
    ta.remove();
  }
  
  // GM_head \u2014 convenience wrapper for HEAD requests
  function GM_head(url, callback) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      if (typeof callback === 'function') callback({ error: 'Missing @grant GM_xmlhttpRequest' });
      return;
    }
    GM_xmlhttpRequest({ method: 'HEAD', url, onload: callback, onerror: callback });
  }

  // GM_notification (with onclick, ondone, timeout, tag, silent, highlight, url)
  const _notifCallbacks = new Map();
  function GM_notification(details, ondone) {
    if (!hasGrant('GM_notification') && !hasGrant('GM.notification')) return;
    let opts;
    if (typeof details === 'string') {
      // GM_notification(text, title, image, onclick)
      opts = { text: details, title: ondone, image: arguments[2] };
      const onclickArg = arguments[3];
      if (typeof onclickArg === 'function') opts.onclick = onclickArg;
      ondone = undefined;
    } else {
      opts = details;
    }
    if (typeof ondone === 'function') opts.ondone = ondone;
    const notifTag = opts.tag || ('notif_' + Math.random().toString(36).substring(2));
    // Store callbacks
    _notifCallbacks.set(notifTag, {
      onclick: opts.onclick, ondone: opts.ondone
    });
    // Highlight tab instead of notification
    if (opts.highlight) {
      sendToBackground('GM_focusTab', {}).catch(() => {});
      if (opts.ondone) { try { opts.ondone(); } catch(e) {} }
      _notifCallbacks.delete(notifTag); // Clean up \u2014 no notification created
      return;
    }
    sendToBackground('GM_notification', {
      scriptId,
      title: opts.title || GM_info.script.name,
      text: opts.text || opts.body || '',
      image: opts.image,
      timeout: opts.timeout || 0,
      tag: notifTag,
      silent: opts.silent || false,
      hasOnclick: !!opts.onclick,
      hasOndone: !!opts.ondone
    }).catch(() => {});
  }
  
  // GM_openInTab (with close(), onclose, insert, setParent, incognito)
  const _openedTabs = new Map();
  function GM_openInTab(url, options) {
    if (!hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return null;
    const opts = typeof options === 'boolean' ? { active: !options } : (options || {});
    const tabHandle = { closed: false, onclose: null, close: () => {} };
    sendToBackground('GM_openInTab', {
      url, scriptId, trackClose: true,
      active: opts.active, insert: opts.insert,
      setParent: opts.setParent, background: opts.background
    }).then(result => {
      if (result && result.tabId) {
        _openedTabs.set(result.tabId, tabHandle);
        tabHandle.close = () => {
          sendToBackground('GM_closeTab', { tabId: result.tabId }).catch(() => {});
          tabHandle.closed = true;
        };
      }
    }).catch(() => {});
    return tabHandle;
  }
  
  // GM_download (with onload, onerror, onprogress, ontimeout callbacks)
  const _downloadCallbacks = new Map();
  function GM_download(details) {
    if (!hasGrant('GM_download') && !hasGrant('GM.download')) return;
    let opts;
    if (typeof details === 'string') {
      opts = { url: details, name: arguments[1] || details.split('/').pop() };
    } else {
      opts = { ...details };
    }
    const callbacks = {
      onload: opts.onload, onerror: opts.onerror,
      onprogress: opts.onprogress, ontimeout: opts.ontimeout
    };
    delete opts.onload; delete opts.onerror;
    delete opts.onprogress; delete opts.ontimeout;
    opts.scriptId = scriptId;
    opts.hasCallbacks = !!(callbacks.onload || callbacks.onerror || callbacks.onprogress || callbacks.ontimeout);
    sendToBackground('GM_download', opts).then(result => {
      if (result && result.downloadId) {
        _downloadCallbacks.set(result.downloadId, callbacks);
      }
      if (result && result.error) {
        if (callbacks.onerror) try { callbacks.onerror({ error: result.error }); } catch(e) {}
        if (result.downloadId) _downloadCallbacks.delete(result.downloadId);
      }
    }).catch(e => {
      if (callbacks.onerror) try { callbacks.onerror({ error: e.message || 'Download failed' }); } catch(ex) {}
    });
  }
  
  // GM_log
  function GM_log(...args) {
    console.log('[' + GM_info.script.name + ']', ...args);
  }
  
  // GM_registerMenuCommand (with extended options: id, accessKey, autoClose, title)
  const _menuCmds = new Map();
  function GM_registerMenuCommand(caption, callback, accessKeyOrOptions) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return null;
    let opts = {};
    if (typeof accessKeyOrOptions === 'string') {
      opts.accessKey = accessKeyOrOptions;
    } else if (accessKeyOrOptions && typeof accessKeyOrOptions === 'object') {
      opts = accessKeyOrOptions;
    }
    const id = opts.id || Math.random().toString(36).substring(2);
    _menuCmds.set(id, { callback, caption });
    sendToBackground('GM_registerMenuCommand', {
      scriptId, commandId: id, caption,
      accessKey: opts.accessKey || '',
      autoClose: opts.autoClose !== false,
      title: opts.title || ''
    }).catch(() => {});
    return id;
  }

  function GM_unregisterMenuCommand(id) {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand') &&
        !hasGrant('GM_unregisterMenuCommand') && !hasGrant('GM.unregisterMenuCommand')) return;
    _menuCmds.delete(id);
    sendToBackground('GM_unregisterMenuCommand', { scriptId, commandId: id }).catch(() => {});
  }

  function GM_getMenuCommands() {
    if (!hasGrant('GM_registerMenuCommand') && !hasGrant('GM.registerMenuCommand')) return [];
    return Array.from(_menuCmds.entries()).map(([id, entry]) => ({ id, name: entry.caption || id, caption: entry.caption || id }));
  }
  
  // GM_getResourceText / GM_getResourceURL
  async function GM_getResourceText(name) {
    if (!hasGrant('GM_getResourceText') && !hasGrant('GM.getResourceText')) return null;
    return await sendToBackground('GM_getResourceText', { scriptId, name });
  }
  
  async function GM_getResourceURL(name, isBlobUrl) {
    if (!hasGrant('GM_getResourceURL') && !hasGrant('GM.getResourceUrl')) return null;
    const dataUri = await sendToBackground('GM_getResourceURL', { scriptId, name });
    if (!dataUri) return null;
    // Return data URI by default, or convert to blob URL if requested
    if (isBlobUrl !== true) return dataUri;
    try {
      const resp = await fetch(dataUri);
      const blob = await resp.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      return dataUri;
    }
  }
  
  // GM_addElement
  function GM_addElement(parentOrTag, tagOrAttrs, attrsOrUndefined) {
    if (!hasGrant('GM_addElement') && !hasGrant('GM.addElement')) return null;
    let parent, tag, attrs;
    if (typeof parentOrTag === 'string') {
      tag = parentOrTag;
      attrs = tagOrAttrs;
      parent = document.head || document.documentElement;
    } else {
      parent = parentOrTag;
      tag = tagOrAttrs;
      attrs = attrsOrUndefined;
    }
    const el = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'textContent') el.textContent = v;
        else if (k === 'innerHTML') {
          // Sanitize: strip event handlers and script tags to prevent XSS
          const temp = document.createElement('template');
          temp.innerHTML = v;
          temp.content.querySelectorAll('script').forEach(s => s.remove());
          temp.content.querySelectorAll('*').forEach(node => {
            for (const attr of [...node.attributes]) {
              const lowerName = attr.name.toLowerCase();
              const lowerValue = attr.value.trim().toLowerCase();
              if (lowerName.startsWith('on') || lowerValue.startsWith('javascript:') || lowerValue.startsWith('vbscript:')) {
                node.removeAttribute(attr.name);
              }
            }
          });
          el.innerHTML = temp.innerHTML;
        }
        else el.setAttribute(k, v);
      });
    }
    if (parent) parent.appendChild(el);
    return el;
  }
  
  // GM_loadScript - Dynamically fetch and eval a script URL at runtime
  // Fetches via background service worker (bypasses CORS/CSP), evals in userscript scope
  // Masks module/define/exports to force UMD libraries to set globals on window
  const _loadedScripts = new Set();
  async function GM_loadScript(url, options = {}) {
    if (!hasGrant('GM_xmlhttpRequest') && !hasGrant('GM.xmlHttpRequest')) {
      throw new Error('GM_loadScript requires @grant GM_xmlhttpRequest');
    }
    if (!url) throw new Error('GM_loadScript: No URL provided');
    if (!options.force && _loadedScripts.has(url)) return;
    const result = await sendToBackground('GM_loadScript', { url, timeout: options.timeout });
    if (!result || result.error) throw new Error('GM_loadScript: ' + (result?.error || 'request timed out'));
    // Temporarily mask module systems so UMD scripts create window globals
    const _savedModule = window.module;
    const _savedExports = window.exports;
    const _savedDefine = window.define;
    try {
      window.module = undefined;
      window.exports = undefined;
      window.define = undefined;
      const fn = new Function(result.code);
      fn.call(window);
    } finally {
      window.module = _savedModule;
      window.exports = _savedExports;
      window.define = _savedDefine;
    }
    _loadedScripts.add(url);
  }

  // GM_getTab / GM_saveTab / GM_getTabs (real implementations via background)
  let _tabData = {};
  function GM_getTab(callback) {
    if (!hasGrant('GM_getTab') && !hasGrant('GM.getTab')) { if (callback) callback(_tabData); return _tabData; }
    sendToBackground('GM_getTab', { scriptId }).then(data => {
      _tabData = data || {};
      if (callback) callback(_tabData);
    }).catch(() => { if (callback) callback(_tabData); });
    return _tabData;
  }
  function GM_saveTab(tab) {
    if (!hasGrant('GM_saveTab') && !hasGrant('GM.saveTab')) return;
    _tabData = tab || {};
    sendToBackground('GM_saveTab', { scriptId, data: _tabData }).catch(() => {});
  }
  function GM_getTabs(callback) {
    if (!hasGrant('GM_getTabs') && !hasGrant('GM.getTabs')) { if (callback) callback({}); return; }
    sendToBackground('GM_getTabs', { scriptId }).then(data => {
      if (callback) callback(data || {});
    }).catch(() => { if (callback) callback({}); });
  }

  function GM_focusTab() {
    if (!hasGrant('GM_focusTab') && !hasGrant('GM.focusTab') &&
        !hasGrant('GM_openInTab') && !hasGrant('GM.openInTab')) return;
    sendToBackground('GM_focusTab', {}).catch(() => {});
  }

  // unsafeWindow
  const unsafeWindow = window;
  
  // Helper to wait for cache to be ready (used by async GM.* API)
  function _waitForCache() {
    if (_cacheReady) return Promise.resolve();
    if (!_cacheReadyPromise) {
      _cacheReadyPromise = new Promise(resolve => {
        _cacheReadyResolve = resolve;
      });
    }
    return _cacheReadyPromise;
  }
  
  // GM.* Promise-based API
  // These wait for storage to be refreshed before returning, ensuring fresh values
  // GM_cookie (list, set, delete)
  const GM_cookie = {
    list: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback([], new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_list', details || {}).then(r => {
        if (callback) callback(r?.cookies || [], r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback([], e); });
    },
    set: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_set', details || {}).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    delete: (details, callback) => {
      if (!hasGrant('GM_cookie') && !hasGrant('GM.cookie')) {
        if (callback) callback(new Error('Permission denied'));
        return;
      }
      sendToBackground('GM_cookie_delete', details || {}).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    }
  };

  // Event listener for notification/download/tab close events from background
  // Content.js forwards these with 'type' field (not 'action') and flat structure (not nested 'data')
  window.addEventListener('message', function __svEventHandler(event) {
    if (!event.data || event.data.channel !== CHANNEL_ID || event.data.direction !== 'to-userscript') return;

    // Notification events (content.js sends: type, scriptId, notifTag, eventType)
    if (event.data.type === 'notificationEvent' && event.data.scriptId === scriptId) {
      const tag = event.data.notifTag;
      const cbs = _notifCallbacks.get(tag);
      if (!cbs) return;
      if (event.data.eventType === 'click' && cbs.onclick) { try { cbs.onclick(); } catch(e) {} }
      if (event.data.eventType === 'done') {
        if (cbs.ondone) { try { cbs.ondone(); } catch(e) {} }
        _notifCallbacks.delete(tag);
      }
    }

    // Download events (content.js sends: type, scriptId, downloadId, eventType, data)
    if (event.data.type === 'downloadEvent' && event.data.scriptId === scriptId) {
      const d = event.data.data || {};
      const cbs = _downloadCallbacks.get(event.data.downloadId);
      if (!cbs) return;
      const evType = event.data.eventType;
      if (evType === 'load' && cbs.onload) { try { cbs.onload({ url: d.url }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'error' && cbs.onerror) { try { cbs.onerror({ error: d.error }); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
      if (evType === 'progress' && cbs.onprogress) { try { cbs.onprogress({ loaded: d.loaded, total: d.total }); } catch(e) {} }
      if (evType === 'timeout' && cbs.ontimeout) { try { cbs.ontimeout(); } catch(e) {} _downloadCallbacks.delete(event.data.downloadId); }
    }

    // Tab close events (content.js sends: type, scriptId, closedTabId)
    if (event.data.type === 'openedTabClosed' && event.data.scriptId === scriptId) {
      const tabId = event.data.closedTabId;
      const handle = _openedTabs.get(tabId);
      if (handle) {
        handle.closed = true;
        if (typeof handle.onclose === 'function') { try { handle.onclose(); } catch(e) {} }
        _openedTabs.delete(tabId);
      }
    }
  });

  // GM.* Promise-based API
  const GM = {
    info: GM_info,
    getValue: async (k, d) => {
      await _waitForCache();
      return GM_getValue(k, d);
    },
    setValue: (k, v) => Promise.resolve(GM_setValue(k, v)),
    deleteValue: (k) => Promise.resolve(GM_deleteValue(k)),
    listValues: async () => {
      await _waitForCache();
      return GM_listValues();
    },
    getValues: async (keys) => {
      await _waitForCache();
      return GM_getValues(keys);
    },
    setValues: (vals) => Promise.resolve(GM_setValues(vals)),
    deleteValues: (keys) => Promise.resolve(GM_deleteValues(keys)),
    addStyle: (css) => Promise.resolve(GM_addStyle(css)),
    xmlHttpRequest: (d) => {
      let control;
      const promise = new Promise((res, rej) => {
        control = GM_xmlhttpRequest({
          ...d,
          onload: (r) => { if (d.onload) d.onload(r); res(r); },
          onerror: (e) => { if (d.onerror) d.onerror(e); rej(e.error || e); },
          ontimeout: (e) => { if (d.ontimeout) d.ontimeout(e); rej(new Error('timeout')); },
          onabort: (e) => { if (d.onabort) d.onabort(e); rej(new Error('aborted')); }
        });
      });
      promise.abort = () => control.abort();
      return promise;
    },
    notification: (d, ondone) => Promise.resolve(GM_notification(d, ondone)),
    setClipboard: (t, type) => Promise.resolve(GM_setClipboard(t, type)),
    openInTab: (u, o) => Promise.resolve(GM_openInTab(u, o)),
    download: (d) => Promise.resolve(GM_download(d)),
    getResourceText: (n) => GM_getResourceText(n),
    getResourceUrl: (n) => GM_getResourceURL(n),
    registerMenuCommand: (c, cb, o) => Promise.resolve(GM_registerMenuCommand(c, cb, o)),
    unregisterMenuCommand: (id) => Promise.resolve(GM_unregisterMenuCommand(id)),
    addValueChangeListener: (k, cb) => Promise.resolve(GM_addValueChangeListener(k, cb)),
    removeValueChangeListener: (id) => Promise.resolve(GM_removeValueChangeListener(id)),
    getTab: () => new Promise(r => GM_getTab(r)),
    saveTab: (t) => Promise.resolve(GM_saveTab(t)),
    getTabs: () => new Promise(r => GM_getTabs(r)),
    loadScript: (url, opts) => GM_loadScript(url, opts),
    cookies: {
      list: (d) => new Promise((res, rej) => GM_cookie.list(d, (cookies, err) => err ? rej(err) : res(cookies))),
      set: (d) => new Promise((res, rej) => GM_cookie.set(d, (err) => err ? rej(err) : res())),
      delete: (d) => new Promise((res, rej) => GM_cookie.delete(d, (err) => err ? rej(err) : res()))
    }
  };

  // CRITICAL: Expose all GM_* functions to window for Tampermonkey/Violentmonkey compatibility
  window.GM_info = GM_info;
  window.GM_getValue = GM_getValue;
  window.GM_setValue = GM_setValue;
  window.GM_deleteValue = GM_deleteValue;
  window.GM_listValues = GM_listValues;
  window.GM_getValues = GM_getValues;
  window.GM_setValues = GM_setValues;
  window.GM_deleteValues = GM_deleteValues;
  window.GM_addStyle = GM_addStyle;
  window.GM_xmlhttpRequest = GM_xmlhttpRequest;
  window.GM_head = GM_head;
  window.GM_setClipboard = GM_setClipboard;
  window.GM_notification = GM_notification;
  window.GM_openInTab = GM_openInTab;
  window.GM_download = GM_download;
  window.GM_log = GM_log;
  window.GM_registerMenuCommand = GM_registerMenuCommand;
  window.GM_unregisterMenuCommand = GM_unregisterMenuCommand;
  window.GM_getMenuCommands = GM_getMenuCommands;
  window.GM_getResourceText = GM_getResourceText;
  window.GM_getResourceURL = GM_getResourceURL;
  window.GM_addElement = GM_addElement;
  window.GM_loadScript = GM_loadScript;
  window.GM_getTab = GM_getTab;
  window.GM_saveTab = GM_saveTab;
  window.GM_getTabs = GM_getTabs;
  window.GM_addValueChangeListener = GM_addValueChangeListener;
  window.GM_removeValueChangeListener = GM_removeValueChangeListener;
  window.GM_cookie = GM_cookie;
  window.GM_focusTab = GM_focusTab;

  // ========== GM_webRequest (Tampermonkey-compatible, declarativeNetRequest-backed) ==========
  function GM_webRequest(rules, listener) {
    if (!hasGrant('GM_webRequest')) {
      console.warn('[ScriptVault] GM_webRequest requires @grant GM_webRequest');
      return;
    }
    const ruleArray = Array.isArray(rules) ? rules : [rules];
    sendToBackground('GM_webRequest', { rules: ruleArray }).catch(e =>
      console.warn('[ScriptVault] GM_webRequest failed:', e.message)
    );
    // listener is called with (info, message, details) when a rule matches;
    // declarativeNetRequest doesn't support runtime callbacks, so we no-op this.
    if (typeof listener === 'function') {
      console.info('[ScriptVault] GM_webRequest: runtime listener not supported in MV3 \u2014 use @webRequest metadata for static rules');
    }
  }
  window.GM_webRequest = GM_webRequest;

  window.unsafeWindow = unsafeWindow;
  window.GM = GM;

  // ========== window.onurlchange (SPA navigation detection) ==========
  // Tampermonkey-compatible: fires when URL changes via pushState/replaceState/popstate
  if (hasGrant('window.onurlchange')) {
    let _lastUrl = location.href;
    const _urlChangeHandlers = [];

    function __checkUrlChange() {
      const newUrl = location.href;
      if (newUrl !== _lastUrl) {
        const oldUrl = _lastUrl;
        _lastUrl = newUrl;
        const event = { url: newUrl, oldUrl };
        _urlChangeHandlers.forEach(fn => { try { fn(event); } catch(e) {} });
        if (typeof window.onurlchange === 'function') {
          try { window.onurlchange(event); } catch(e) {}
        }
      }
    }

    // Intercept history API
    const _origPushState = history.pushState;
    const _origReplaceState = history.replaceState;
    history.pushState = function() {
      _origPushState.apply(this, arguments);
      __checkUrlChange();
    };
    history.replaceState = function() {
      _origReplaceState.apply(this, arguments);
      __checkUrlChange();
    };
    window.addEventListener('popstate', __checkUrlChange);
    window.addEventListener('hashchange', __checkUrlChange);

    // Allow adding multiple handlers via addEventListener pattern
    window.addEventListener = new Proxy(window.addEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          if (!_urlChangeHandlers.includes(args[1])) {
            _urlChangeHandlers.push(args[1]);
          }
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    window.removeEventListener = new Proxy(window.removeEventListener, {
      apply(target, thisArg, args) {
        if (args[0] === 'urlchange') {
          const idx = _urlChangeHandlers.indexOf(args[1]);
          if (idx >= 0) _urlChangeHandlers.splice(idx, 1);
          return;
        }
        return Reflect.apply(target, thisArg, args);
      }
    });
    window.onurlchange = null; // Initialize as settable
  }

  // ========== window.close / window.focus grants ==========
  if (hasGrant('window.close')) {
    // Already available in USER_SCRIPT world, but explicitly expose
    window.close = window.close.bind(window);
  }
  if (hasGrant('window.focus')) {
    window.focus = window.focus.bind(window);
  }

  // ========== GM_audio API (Tampermonkey-compatible tab mute control) ==========
  const GM_audio = {
    setMute: (details, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      sendToBackground('GM_audio_setMute', { mute: details?.mute ?? details }).then(r => {
        if (callback) callback(r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(e); });
    },
    getState: (callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(null, new Error('Permission denied')); return; }
      sendToBackground('GM_audio_getState', {}).then(r => {
        if (callback) callback(r, r?.error ? new Error(r.error) : undefined);
      }).catch(e => { if (callback) callback(null, e); });
    },
    _listeners: [],
    _watching: false,
    _msgHandler: null,
    addStateChangeListener: (listener, callback) => {
      if (!hasGrant('GM_audio')) { if (callback) callback(new Error('Permission denied')); return; }
      GM_audio._listeners.push(listener);
      if (!GM_audio._watching) {
        GM_audio._watching = true;
        sendToBackground('GM_audio_watchState', {});
        // Listen for audio state change events from content script bridge
        GM_audio._msgHandler = (e) => {
          if (e.source !== window || !e.data || e.data.channel !== CHANNEL_ID) return;
          if (e.data.type === 'audioStateChanged') {
            const state = e.data.data;
            for (const fn of GM_audio._listeners) {
              try { fn(state); } catch (err) { console.error('[GM_audio listener]', err); }
            }
          }
        };
        window.addEventListener('message', GM_audio._msgHandler);
      }
      if (callback) callback();
    },
    removeStateChangeListener: (listener, callback) => {
      const idx = GM_audio._listeners.indexOf(listener);
      if (idx >= 0) GM_audio._listeners.splice(idx, 1);
      if (GM_audio._listeners.length === 0 && GM_audio._watching) {
        GM_audio._watching = false;
        if (GM_audio._msgHandler) {
          window.removeEventListener('message', GM_audio._msgHandler);
          GM_audio._msgHandler = null;
        }
        sendToBackground('GM_audio_unwatchState', {});
      }
      if (callback) callback();
    }
  };
  window.GM_audio = GM_audio;

  // ========== DOM HELPER FUNCTIONS ==========
  // These help userscripts handle DOM timing issues gracefully
  // Use these when document.body/head might not exist yet
  
  // Wait for any element matching selector to appear in DOM
  function __waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      // Check if already exists
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      
      let resolved = false;
      const observer = new MutationObserver((mutations, obs) => {
        if (resolved) return;
        const el = document.querySelector(selector);
        if (el) {
          resolved = true;
          obs.disconnect();
          resolve(el);
        }
      });
      
      // Start observing - handle case where documentElement might not exist yet
      const root = document.documentElement || document;
      if (root && typeof root.nodeType !== 'undefined') {
        observer.observe(root, { childList: true, subtree: true });
      }
      
      // Timeout with final check
      setTimeout(() => {
        if (resolved) return;
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else {
          reject(new Error('[ScriptVault] Timeout waiting for element: ' + selector));
        }
      }, timeout);
    });
  }
  
  // Wait for document.body to be available
  function __waitForBody(timeout = 10000) {
    if (document.body) return Promise.resolve(document.body);
    return __waitForElement('body', timeout);
  }
  
  // Wait for document.head to be available
  function __waitForHead(timeout = 10000) {
    if (document.head) return Promise.resolve(document.head);
    return __waitForElement('head', timeout);
  }
  
  // Safe MutationObserver that waits for target element to exist
  // Prevents "parameter 1 is not of type 'Node'" errors
  function __safeObserve(target, options, callback) {
    // Handle selector string or element
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    
    // If element exists and is valid, observe immediately
    if (element && element.nodeType === Node.ELEMENT_NODE) {
      const observer = new MutationObserver(callback);
      observer.observe(element, options);
      return { observer, promise: Promise.resolve(observer) };
    }
    
    // Element doesn't exist yet - wait for it
    const selectorToWait = typeof target === 'string' ? target : 'body';
    const promise = __waitForElement(selectorToWait)
      .then(el => {
        const observer = new MutationObserver(callback);
        observer.observe(el, options);
        return observer;
      })
      .catch(() => null);
    
    return { observer: null, promise };
  }
  
  // Expose DOM helpers to window for userscripts to use
  window.__ScriptVault_waitForElement = __waitForElement;
  window.__ScriptVault_waitForBody = __waitForBody;
  window.__ScriptVault_waitForHead = __waitForHead;
  window.__ScriptVault_safeObserve = __safeObserve;

  // Also expose as shorter aliases
  window.waitForElement = __waitForElement;
  window.waitForBody = __waitForBody;
  window.waitForHead = __waitForHead;
  window.safeObserve = __safeObserve;

  // ========== Network Proxy (full capture: fetch, XHR, WebSocket, sendBeacon) ==========
  // Intercepts all network calls made by this script and logs them to the network log.
  // Logs are viewable in the DevTools panel and the dashboard Network Log.
  (function __svNetProxy() {
    const _scriptName = ${JSON.stringify(o.name||t.id)};
    const _scriptId = ${JSON.stringify(t.id)};

    function _log(entry) {
      sendToBackground('netlog_record', { scriptId: _scriptId, scriptName: _scriptName, ...entry }).catch(() => {});
    }

    // \u2500\u2500 fetch \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const _origFetch = window.fetch;
    window.fetch = function __svFetch(input, init) {
      const method = (init?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input?.url || String(input);
      const t0 = performance.now();
      return _origFetch.apply(this, arguments).then(resp => {
        const duration = Math.round(performance.now() - t0);
        const cl = parseInt(resp.headers.get('content-length') || '0') || 0;
        _log({ type: 'fetch', method, url, status: resp.status, statusText: resp.statusText, duration, responseSize: cl, responseHeaders: Object.fromEntries(resp.headers.entries()) });
        return resp;
      }, err => {
        const duration = Math.round(performance.now() - t0);
        _log({ type: 'fetch', method, url, error: err?.message || String(err), duration });
        throw err;
      });
    };

    // \u2500\u2500 XMLHttpRequest \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const _OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function __svXHR() {
      const xhr = new _OrigXHR();
      let _method = 'GET', _url = '', _t0 = 0;
      const _origOpen = xhr.open.bind(xhr);
      xhr.open = function(method, url) {
        _method = (method || 'GET').toUpperCase();
        _url = String(url);
        return _origOpen.apply(this, arguments);
      };
      const _origSend = xhr.send.bind(xhr);
      xhr.send = function() {
        _t0 = performance.now();
        xhr.addEventListener('loadend', () => {
          const duration = Math.round(performance.now() - _t0);
          if (xhr.status) {
            _log({ type: 'xhr', method: _method, url: _url, status: xhr.status, statusText: xhr.statusText, duration, responseSize: (xhr.responseText || '').length });
          } else {
            _log({ type: 'xhr', method: _method, url: _url, error: 'Request failed', duration });
          }
        }, { once: true });
        return _origSend.apply(this, arguments);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = _OrigXHR.prototype;

    // \u2500\u2500 WebSocket \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const _OrigWS = window.WebSocket;
    window.WebSocket = function __svWebSocket(url, protocols) {
      const ws = protocols ? new _OrigWS(url, protocols) : new _OrigWS(url);
      const t0 = performance.now();
      let bytesSent = 0, bytesRecv = 0;
      ws.addEventListener('open', () => {
        _log({ type: 'websocket', method: 'WS', url: String(url), status: 101, statusText: 'Switching Protocols', duration: Math.round(performance.now() - t0) });
      });
      ws.addEventListener('message', e => { bytesRecv += (e.data?.length || 0); });
      ws.addEventListener('close', e => {
        _log({ type: 'websocket', method: 'WS_CLOSE', url: String(url), status: e.code, duration: Math.round(performance.now() - t0), responseSize: bytesRecv });
      });
      const _origSendWS = ws.send.bind(ws);
      ws.send = function(data) { bytesSent += (data?.length || 0); return _origSendWS(data); };
      return ws;
    };
    window.WebSocket.prototype = _OrigWS.prototype;
    Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

    // \u2500\u2500 sendBeacon \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const _origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function __svBeacon(url, data) {
      const result = _origBeacon(url, data);
      const size = data ? (typeof data === 'string' ? data.length : (data?.byteLength || data?.size || 0)) : 0;
      _log({ type: 'beacon', method: 'POST', url: String(url), status: result ? 200 : 0, duration: 0, responseSize: size });
      return result;
    };
  })();
  // ========== End Network Proxy ==========

  // GM APIs exposed log disabled for performance
  // console.log('[ScriptVault] GM APIs exposed to window for:', meta.name);

  // ============ @require Scripts ============
  // These run after GM APIs are available on window
${u}
${d}
  // ============ End @require Scripts ============

  // Wait for storage to be refreshed, then execute the userscript
  // This ensures scripts see fresh values when using GM_getValue
  (async function __scriptMonkeyRunner() {
    await _waitForCache();
    const __startTime = performance.now();
    try {
`,y=`
    } catch (e) {
      // Report error to background for profiling
      sendToBackground('reportExecError', { scriptId, error: (e?.message || String(e)).slice(0, 200) }).catch(() => {});
    } finally {
      // Report execution time to background for profiling
      const __elapsed = Math.round((performance.now() - __startTime) * 100) / 100;
      sendToBackground('reportExecTime', { scriptId, time: __elapsed, url: location.href }).catch(() => {});
    }
  })();
})();
`;let _=o["top-level-await"]?`(async () => {
${t.code}
})();`:t.code;return o.delay>0&&(_=`setTimeout(() => {
${_}
}, ${o.delay});`),h+_+y}function at(t){return t?t==="<all_urls>"?!0:/^(\*|https?|file|ftp):\/\/(\*|\*\.[^/*]+|[^/*:]+(?::\d+)?)\/.*$/.test(t):!1}function Ir(t){if(!t||!t.startsWith("/")||t.length<=2)return!1;const r=t.match(/^\/(.+?)\/([gimsuy]*)$/);return r?/[\\^$\[(+?{|]/.test(r[1]):!1}function Da(t){const r=t.match(/^\/(.+)\/([gimsuy]*)$/);if(!r)return null;try{return new RegExp(r[1],r[2])}catch{return null}}function Ua(t){const r=t.replace(/^\//,"").replace(/\/[gimsuy]*$/,""),a=[],e=/([a-z0-9][-a-z0-9]*)\\\.\(([^)]+)\)/gi;let s;for(;(s=e.exec(r))!==null;){const c=s[1],d=s[2].split("|").map(f=>f.replace(/\\\./g,"."));for(const f of d)/^[a-z0-9][-a-z0-9.]*$/i.test(f)&&f.length>=2&&f.length<=30&&(a.push(`*://*.${c}.${f}/*`),a.push(`*://${c}.${f}/*`))}const o=/(?:^|\/\/)(?:\([^)]*\))?([a-z0-9][-a-z0-9]*(?:\\\.)[a-z]{2,10})(?:[\\\/\$\)]|$)/gi;for(;(s=o.exec(r))!==null;){const c=s[1].replace(/\\\./g,".");/^[a-z0-9][-a-z0-9]*\.[a-z]{2,10}$/i.test(c)&&(a.push(`*://*.${c}/*`),a.push(`*://${c}/*`))}return[...new Set(a)]}function jt(t){if(!t)return null;if(at(t))return t;if(t==="*")return"<all_urls>";let r=t;if(r.startsWith("*://"))return r.slice(4).includes("/")||(r+="/*"),at(r)?r:null;if(r.match(/^https?:\/\//))return!r.includes("/*")&&!r.endsWith("/")&&(r+="/*"),at(r)?r:null;if(r.startsWith("*.")){const a="*://"+r+"/*";return at(a)?a:null}if(!r.includes("://")&&!r.startsWith("/")){const a="*://"+r+"/*";return at(a)?a:null}return null}Aa()});Ga();})();
