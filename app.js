(function(){
const C = window.CONFIG;
const brl = n => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const $ = id => document.getElementById(id);
const norm = s => (s||"").toString().normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();

// CSV -> matriz
function parseCSV(t){
  const rows=[];let r=[],f="",q=false;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(q){ if(c=='"'){ if(t[i+1]=='"'){f+='"';i++;} else q=false; } else f+=c; }
    else if(c=='"') q=true;
    else if(c==","){ r.push(f);f=""; }
    else if(c=="\n"||c=="\r"){ if(c=="\r"&&t[i+1]=="\n")i++; r.push(f);rows.push(r);r=[];f=""; }
    else f+=c;
  }
  if(f!==""||r.length){r.push(f);rows.push(r);}
  return rows;
}
// "R$ 1.234,56" -> 1234.56
function money(s){
  if(s==null) return 0;
  let x=String(s).replace(/[^\d,.-]/g,"");
  if(!x) return 0;
  if(x.includes(",")) x=x.replace(/\./g,"").replace(",",".");
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(x)) x=x.replace(/\./g,"");
  const n=parseFloat(x); return isNaN(n)?0:n;
}
function isPago(s){
  const n=norm(s); if(!n) return false;
  if(C.PALAVRAS_NAO_PAGO.some(p=>n.includes(norm(p)))) return false;
  return C.PALAVRAS_PAGO.some(p=>n.includes(norm(p)));
}
// extrai data (com ano) de um texto; tolera "29/092026"; retorna "aaaa-mm-dd" ou null
function dataDe(s){
  s=String(s||"");
  let m=s.match(/(\d{4})-(\d{2})-(\d{2})/), d,mo,y;
  if(m){ y=+m[1];mo=+m[2];d=+m[3]; }
  else{
    m=s.match(/(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]?\s*(\d{4})/);
    if(!m) return null;
    d=+m[1];mo=+m[2];y=+m[3];
    if(mo>12&&d<=12){ const t=d;d=mo;mo=t; }
  }
  if(d<1||d>31||mo<1||mo>12) return null;
  return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
}
// "30/11; 22/12" -> ["2026-11-30","2026-12-22"] (sem ano: assume o ano corrente e avança o ano quando a sequência volta no calendário)
function vencimentos(txt){
  const hoje=new Date(); const ref=hoje.toISOString().slice(0,10);
  const re=/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/g; let m, out=[], ano=null, ultimo="";
  while((m=re.exec(String(txt||"")))){
    const d=+m[1], mo=+m[2]; if(d<1||d>31||mo<1||mo>12) continue;
    let y=m[3]?(+m[3]<100?2000+ +m[3]:+m[3]):null;
    if(y==null){
      if(ano==null){ ano=hoje.getFullYear(); const t0=`${ano}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; if(t0<new Date(hoje.getTime()-180*864e5).toISOString().slice(0,10)) ano++; }
      y=ano;
      let k=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      if(ultimo&&k<ultimo){ ano++; y=ano; k=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`; }
      ultimo=k;
    }
    out.push(`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }
  return out;
}
const proc=s=>String(s||"").replace(/\.0+$/,"").replace(/\D/g,"");
// acha a linha de cabeçalho (a que contém "Nome do Contribuinte") e devolve objetos por coluna
function tabela(rows){
  let h=rows.findIndex(r=>r.some(c=>norm(c).includes("contribuinte")) && r.some(c=>/valor|situacao|parcela|tentativa/.test(norm(c))));
  if(h<0) h=rows.findIndex(r=>r.some(c=>/valor atual|valor da parcela|tentativa/.test(norm(c))));
  if(h<0) return {head:[],data:[]};
  const head=rows[h].map(norm);
  const data=rows.slice(h+1).filter(r=>r.some(c=>(c||"").trim()) && (r[0]||"").trim());
  return {head,data};
}
const col=(head,...nomes)=>{ for(const n of nomes){ const i=head.findIndex(x=>x.includes(norm(n))); if(i>=0) return i; } return -1; };
const colsTodas=(head,prefixo)=>head.map((x,i)=>x.includes(norm(prefixo))?i:-1).filter(i=>i>=0);

function lerLinks(txt){
  return txt.split(/\s+/).map(l=>{
    const m=l.match(/\/d\/([a-zA-Z0-9-_]+)/); if(!m) return null;
    const g=l.match(/[#&?]gid=(\d+)/);
    return {id:m[1],gid:g?+g[1]:0};
  }).filter(Boolean).filter((f,i,a)=>a.findIndex(x=>x.id===f.id&&x.gid===f.gid)===i);
}
function fontes(){
  try{ const s=JSON.parse(localStorage.getItem("fontes")||"null"); if(s&&s.length) return s; }catch(e){}
  if(C.SHEET_ID&&!C.SHEET_ID.startsWith("COLE")) return C.ABAS.map(a=>({id:C.SHEET_ID,gid:a.gid,nome:a.nome}));
  return [];
}
async function baixa(aba){
  const g=aba.gid!=null?aba.gid:0;
  const base=`https://docs.google.com/spreadsheets/d/${aba.id}`;
  const urls=aba.gid!=null||!aba.nome
    ? [`${base}/export?format=csv&gid=${g}`, `${base}/gviz/tq?tqx=out:csv&headers=0&gid=${g}`]
    : [`${base}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(aba.nome)}`];
  let ultimo;
  for(const u of urls){
    try{
      const r=await fetch(u+(u.includes("?")?"&":"?")+"_="+Date.now()); if(!r.ok) throw new Error("HTTP "+r.status);
      const t=await r.text();
      if(t.trimStart().startsWith("<")) throw new Error("A planilha não está compartilhada como 'qualquer pessoa com o link'");
      return parseCSV(t);
    }catch(e){ ultimo=e; }
  }
  throw ultimo;
}

let gTent,gRec,gFluxo;
const dBR=d=>d.split("-").reverse().join("/");
function renderFluxo(ag,semData){
  const hoje=new Date().toISOString().slice(0,10), lim=new Date(Date.now()+30*864e5).toISOString().slice(0,10);
  const soma=a=>a.reduce((t,x)=>t+x.v,0);
  const venc=ag.filter(x=>x.d<hoje), futuras=ag.filter(x=>x.d>=hoje), prox=futuras.filter(x=>x.d<=lim);
  $("fTotal").textContent=brl(soma(ag)+semData); $("fVenc").textContent=brl(soma(venc)); $("fProx").textContent=brl(soma(prox)); $("fSem").textContent=brl(semData);
  const tb=$("tFluxo").querySelector("tbody"); tb.innerHTML="";
  ag.slice(0,300).forEach(x=>{
    const tr=document.createElement("tr"); const atraso=x.d<hoje;
    [dBR(x.d),x.nome.trim(),x.proc,brl(x.v),atraso?"Vencida há "+Math.round((new Date(hoje)-new Date(x.d))/864e5)+" dia(s)":"A vencer"].forEach((t,i)=>{
      const td=document.createElement("td"); td.textContent=t; if(i===2)td.className="mono"; if(i===3)td.className="num";
      if(i===4)td.className=atraso?"neg":"mut"; tr.appendChild(td); });
    tb.appendChild(tr);
  });
  window.__venc=soma(venc);
  $("fEmpty").style.display=ag.length?"none":"block"; $("fWrap").style.display=ag.length?"grid":"none";
  const meses={}; ag.forEach(x=>{ const k=x.d<hoje?"0000-venc":x.d.slice(0,7); meses[k]=(meses[k]||0)+x.v; });
  const ks=Object.keys(meses).sort();
  const mn=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
  const lab=ks.map(k=>k==="0000-venc"?"Vencidas":mn[+k.slice(5)-1]+"/"+k.slice(2,4));
  gFluxo&&gFluxo.destroy();
  gFluxo=new Chart($("cFluxo"),{type:"bar",data:{labels:lab,datasets:[{data:ks.map(k=>meses[k]),backgroundColor:ks.map(k=>k==="0000-venc"?cor("--err"):cor("--pri")),borderRadius:2,maxBarThickness:48}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>brl(c.parsed.y)}}},scales:{y:{beginAtZero:true,grid:{color:cor("--grid")},ticks:{callback:v=>brl(v)}},x:{grid:{display:false}}}}});
}
function cor(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
$("tema").onclick=()=>{ const t=document.documentElement.dataset.theme==="dark"?"light":"dark"; document.documentElement.dataset.theme=t; try{localStorage.setItem("tema",t);}catch(e){} carregar(); };
async function carregar(){ try{ await carregar0(); }catch(e){ const m=$("msg"); m.textContent="Erro ao processar: "+e.message; m.style.display="block"; $("upd").textContent="Erro"; console.error(e); } }
async function carregar0(){
  const msg=$("msg"); msg.style.display="none";
  const FONTES=fontes();
  $("links").value=FONTES.map(f=>`https://docs.google.com/spreadsheets/d/${f.id}/edit#gid=${f.gid||0}`).join("\n");
  if(!FONTES.length){ msg.textContent="Cole o link da planilha (uma linha por aba) no quadro 'Conectar planilha' e clique em Salvar."; msg.style.display="block"; $("conf").open=true; $("upd").textContent="Sem planilha conectada"; return; }
  $("upd").textContent="Atualizando…";
  const dias={}; let totalG=0,linhasC=0,tent=0,tentSemData=0,rec=0,recN=0,parcC=0,parcCN=0,abertoC=0;
  const pagasPorProc={}, parcelas=[];
  const erros=[],resumo=[];
  for(const aba of FONTES){
    let rows; try{ rows=await baixa(aba); }catch(e){ erros.push((aba.nome||("gid "+aba.gid))+" ("+e.message+")"); continue; }
    const {head,data}=tabela(rows);
    const nomeAba=aba.nome||("gid "+(aba.gid||0));
    if(!head.length){ erros.push(nomeAba+" (cabeçalho não encontrado; linhas lidas: "+rows.length+"; primeira linha: "+JSON.stringify((rows[0]||[]).slice(0,8))+")"); continue; }
    const tipo=aba.tipo||(head.some(x=>x.includes("tentativa"))?"cobranca":(head.some(x=>/parcela|vencimento|valor total/.test(x))?"parcelamento":"outra"));
    if(tipo==="outra"){ erros.push(nomeAba+" (aba não reconhecida; colunas encontradas: "+JSON.stringify(head.filter(Boolean).slice(0,14))+")"); continue; }
    resumo.push(`${nomeAba}: ${tipo==="cobranca"?"cobrança":"parcelamento"}, ${data.length} linhas`);
    const iSit=col(head,"situacao"), iProc=col(head,"processo");
    if(tipo==="cobranca"){
      const iVal=col(head,"valor atual");
      const iTent=colsTodas(head,"tentativa"), iRes=colsTodas(head,"resultado"), iObs=col(head,"observac");
      data.forEach(r=>{
        const v=money(r[iVal]);
        if(!v && !proc(r[iProc])) return;            // linha vazia / de teste
        linhasC++; totalG+=v;
        const textos=iTent.map(i=>r[i]||"").concat(iObs>=0?[r[iObs]||""]:[]);
        // "(2/4 parcelas pagas)" -> guarda por processo
        for(const t of textos){ const m=String(t).match(/(\d+)\s*\/\s*(\d+)\s*parcelas?\s*pagas?/i); if(m){ pagasPorProc[proc(r[iProc])]={pagas:+m[1],total:+m[2]}; break; } }
        const pago=isPago(r[iSit])||iRes.some(i=>isPago(r[i]));
        if(pago){ rec+=v; recN++; }
        else if(norm(r[iSit]).includes("parcelad")||pagasPorProc[proc(r[iProc])]){ parcC+=v; parcCN++; }
        else abertoC+=v;
        iTent.forEach(i=>{
          const cel=(r[i]||"").trim(); if(!cel) return;
          tent++; const d=dataDe(cel);
          if(d) dias[d]=(dias[d]||0)+1; else tentSemData++;
        });
      });
    } else {
      const iPar=col(head,"valor da parcela","valor parcela"), iPaga=col(head,"parcelas pagas","valor pago","r$ parc","pago"), iQ=col(head,"qtde de parcelas","qtd","parcelas"), iDA=col(head,"valor total","valor da d","valor d"), iVenc=col(head,"vencimentos","vencimento"); const antes=parcelas.length;
      data.forEach(r=>{
        const totDA=money(r[iDA]);
        if(iPar<0&&iPaga>=0){                       // layout novo: "R$ PARCELAS PAGAS" (valor já pago) + "QTDE" como pagas/total (ex.: 2/4)
          if(!totDA) return;
          const m=String(r[iQ]||"").match(/(\d+)\s*\/\s*(\d+)/);
          parcelas.push({novo:true,nome:r[0]||"",proc:proc(r[iProc]),vencs:iVenc>=0?vencimentos(r[iVenc]):[],tot:totDA,pago:Math.min(money(r[iPaga]),totDA),x:m?+m[1]:0,y:m?+m[2]:0});
          return;
        }
        const vp=money(r[iPar]); if(!vp) return;     // layout antigo: valor da parcela x quantidade
        let q=iQ>=0&&!/[\/-]/.test(r[iQ]||"")?Math.round(money(r[iQ])):0;
        if(!(q>=1&&q<=420)) q=totDA?Math.round(totDA/vp):1;
        parcelas.push({proc:proc(r[iProc]),vp,q,sit:r[iSit]});
      });
      if(parcelas.length===antes) erros.push(nomeAba+" (parcelamento: nenhuma linha com valor; colunas encontradas: "+JSON.stringify(head.filter(Boolean).slice(0,14))+"; 1ª linha de dados: "+JSON.stringify((data[0]||[]).slice(0,10))+")");
    }
  }
  // parcelamento: pagas (texto "x/y parcelas pagas" da cobrança) x a receber
  let pPago=0,pAber=0,pNPagos=0,pX=0,pY=0;
  parcelas.forEach(p=>{
    if(p.novo){ pPago+=p.pago; pAber+=p.tot-p.pago; if(p.tot-p.pago<0.01) pNPagos++; pX+=p.x; pY+=p.y; return; }
    const info=pagasPorProc[p.proc]; const q=p.q; const x=info?Math.min(info.pagas,q):(isPago(p.sit)?q:0);
    pPago+=p.vp*x; pAber+=p.vp*(q-x); if(x>=q) pNPagos++; pX+=x; pY+=q;
  });
  const agenda=[]; let semData=0;
  parcelas.forEach(p=>{
    if(!p.novo) return; const resto=p.tot-p.pago; if(resto<0.01) return;
    if(!p.vencs.length){ semData+=resto; return; }
    const v=resto/p.vencs.length;
    p.vencs.forEach(d=>agenda.push({d,v,nome:p.nome,proc:p.proc}));
  });
  agenda.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);
  renderFluxo(agenda,semData);
  const vencido=Math.min(window.__venc||0,parcC), parcEmDia=parcC-vencido;
  if(erros.length){ msg.textContent="Não consegui ler: "+erros.join(", ")+". Confira se a planilha está compartilhada como 'qualquer pessoa com o link' e se os links colados estão certos."; msg.style.display="block"; }

  $("kTotal").textContent=brl(totalG); $("kTotalS").textContent=linhasC+" contribuintes na cobrança";
  $("kTent").textContent=tent; $("kTentS").textContent=tentSemData?tentSemData+" sem data legível":"";
  $("kRec").textContent=brl(rec); $("kRecS").textContent=recN+" guias pagas"+(totalG?" · "+(rec/totalG*100).toFixed(1)+"% do total":"")+(pPago?" · + "+brl(pPago)+" em parcelas pagas":"");
  $("kAReceber").textContent=brl(pAber); $("kARecS").textContent="parcelas ainda não pagas";
  $("pTotal").textContent=brl(pPago+pAber); $("pPago").textContent=brl(pPago); $("pAber").textContent=brl(pAber);
  const pt=pPago+pAber; $("pBar").style.width=(pt?pPago/pt*100:0)+"%";
  $("pInfo").textContent=parcelas.length+" parcelamentos ("+pNPagos+" quitados)"+(pY?" · "+pX+" de "+pY+" parcelas pagas":"");
  $("upd").textContent="Atualizado às "+new Date().toLocaleTimeString("pt-BR")+" · "+resumo.join(" · ");

  const ks=Object.keys(dias).sort();
  const lab=[],val=[];
  if(ks.length){ for(let d=new Date(ks[0]+"T00:00");d<=new Date(ks[ks.length-1]+"T00:00");d.setDate(d.getDate()+1)){
    const k=d.toISOString().slice(0,10); lab.push(k.split("-").reverse().slice(0,2).join("/")); val.push(dias[k]||0);} }
  gTent&&gTent.destroy(); gRec&&gRec.destroy();
  Chart.defaults.font.family="Inter,system-ui,sans-serif"; Chart.defaults.color=cor("--mut");
  const grade=cor("--grid"), azul=cor("--pri"), verde=cor("--ok"), laranja=cor("--warn");
  $("tEmpty").style.display=val.length?"none":"grid";
  gTent=new Chart($("cTent"),{type:"line",data:{labels:lab,datasets:[{label:"Tentativas",data:val,borderColor:azul,backgroundColor:azul+"22",fill:true,tension:0,pointRadius:3,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:grade}},x:{grid:{display:false}}}}});
  const fat=[["Recuperado",rec,verde],["Parcelado em dia",parcEmDia,azul],["Parcelado vencido",vencido,cor("--err")],["Em aberto",abertoC,laranja]];
  const tot=fat.reduce((t,x)=>t+x[1],0)||1, pct=v=>(v/tot*100).toFixed(1).replace(".",",")+"%";
  gRec=new Chart($("cRec"),{type:"doughnut",data:{labels:fat.map(x=>x[0]+" – "+pct(x[1])),datasets:[{data:fat.map(x=>x[1]),backgroundColor:fat.map(x=>x[2]),borderColor:cor("--surf"),borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:"62%",plugins:{legend:{position:"bottom",labels:{boxWidth:10,boxHeight:10}},tooltip:{callbacks:{label:c=>fat[c.dataIndex][0]+": "+brl(c.parsed)+" ("+pct(c.parsed)+")"}}}}});
}
$("salvar").onclick=()=>{ $("upd").textContent="Carregando…"; const f=lerLinks($("links").value); if(!f.length){ alert("Nenhum link válido do Google Sheets encontrado."); return; } localStorage.setItem("fontes",JSON.stringify(f)); carregar(); };
$("limpar").onclick=()=>{ localStorage.removeItem("fontes"); carregar(); };
$("pdf").onclick=async()=>{
  const r=document.documentElement, ant=r.dataset.theme, tit=document.title;
  r.dataset.theme="light"; await carregar();            // PDF sempre em tema claro
  document.title="Painel-Recuperacao-"+new Date().toISOString().slice(0,10);
  const volta=()=>{ document.title=tit; r.dataset.theme=ant; window.removeEventListener("afterprint",volta); carregar(); };
  window.addEventListener("afterprint",volta);
  setTimeout(()=>window.print(),300);                   // espera os gráficos desenharem
};
$("rel").onclick=carregar; carregar(); setInterval(carregar,300000);
})();
