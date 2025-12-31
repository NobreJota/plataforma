async function postJSON(url, data){
  alert('4545' + url + "9" + data)
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return r.json();
}

document.addEventListener("click", async (e) => {
  console.log('');
 // console.log('[ 12 ] public/js/site/admin-home-lauout.js= > btnCriarSlot');
  console.log('');
  // criar slot
  if (e.target.id === "btnCriarSlot") {
    const tipo  = document.getElementById("novoTipo").value;
    const ordem = document.getElementById("novoOrdem").value;
    const titulo= document.getElementById("novoTitulo").value;

    await postJSON("/gravafoto/home-layout/slot/criar", { tipo, ordem, titulo });
    location.reload();
  }

  // salvar textos
  if (e.target.classList.contains("btnSalvarTextos")) {
      alert('7000')
      const slotId = e.target.dataset.slotId;
      alert('3' + '=>' + slotId)
      const titulo = document.querySelector(
        `.slotTitulo[data-slot-id="${slotId}"]`
      )?.value || "";

      alert('300 ' + titulo)
      const subtitulo = document.querySelector(
        `.slotSubtitulo[data-slot-id="${slotId}"]`
      )?.value || "";

      alert('400 ' + subtitulo)
      const link = document.querySelector(
        `.slotLink[data-slot-id="${slotId}"]`
      )?.value || "";
      alert('500 ' + link)
      await postJSON("/gravafoto/home-layout/slot/salvar-textos", {
        slotId,
        titulo,
        subtitulo,
        link
      });

      alert("Textos salvos");
  }
  //}

  // remover slot
  if (e.target.classList.contains("btnRemoverSlot")) {
    const slotId = e.target.dataset.id;
    if (!confirm("Remover este slot?")) return;
    await postJSON("/gravafoto/home-layout/slot/remover", { slotId });
    location.reload();
  }
  
});

async function uploadToSpacesHomeViaPresigned(file, ordem = "01") {
  const qs = new URLSearchParams({
    filename: file.name,
    filetype: file.type || "application/octet-stream",
    ordem: ordem
  });

  // nova rota isolada
  const r = await fetch(`/gravafoto/home_getpresignedurl?${qs.toString()}`);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Falha ao gerar presigned HOME");

  // PUT no Spaces (IMPORTANTE: mandar o x-amz-acl)
  const put = await fetch(j.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-amz-acl": "public-read" // <<< ISSO é o que normalmente está faltando no presigned
    },
    body: file
  });

  if (!put.ok) throw new Error("Falha no upload HOME para o Spaces");

  // URL pública final (origin)
  const BUCKET = "amelia";
  const endpoint = "nyc3.digitaloceanspaces.com";
  return `https://${BUCKET}.${endpoint}/${j.key}`;
}


async function uploadToSpacesViaPresigned(file, ordem = "01") {
   // console.log('');
  //  alert('dentro de f=>uploadToSpaceViaPresigned' + file);
  //  console.log('____________________________________________');
       pegaFoto(file)

      async function pegaFoto(file){
         const n=file
         const r = await fetch(`/gravafoto/home-getpresignedurl?${n}`);
       }
        // 1) pede presigned URL (REAPROVEITA SUA ROTA)
        const qs = new URLSearchParams({
            filename: file.name,
            filetype: file.type || "application/octet-stream",
            ordem: ordem
        });

        // ✅ aqui eu mantive /empresa/getpresignedurl pois você disse: "upload não mexe"
        const r = await fetch(`/gravafoto/home-getpresignedurl?${qs.toString()}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Falha ao gerar presigned URL");

        // 2) faz PUT direto pro Spaces
        const put = await fetch(j.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file
        });
        if (!put.ok) throw new Error("Falha no upload para o Spaces");

        // 3) monta URL pública do objeto (padrão DO Spaces)
        // ⚠️ ajuste se seu projeto usa outro domínio/bucket
        const bucket = (window.__BUCKET_NAME || "").trim(); // opcional
        const endpoint = "nyc3.digitaloceanspaces.com";     // o seu é nyc3
        // Se você não tiver window.__BUCKET_NAME, coloque direto o nome do bucket:
        const BUCKET = bucket || "amelia"; // <<< TROQUE se não for amelia

        const publicUrl = `https://${BUCKET}.${endpoint}/${j.key}`;
        return publicUrl;
}

async function salvarFotoNoSlot({ slotId, imgUrl }) {
  console.log('');
  console.log('__________________________________________________');
  console.log(' [103 ] => salvarFotoNoSlotX');
  console.log(slotId);
  console.log(imgUrl);
  console.log('__________________________________________________');
  const r = await fetch("/gravafoto/home-layout/slot/foto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slotId, imgUrl })
  });

  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "Falha ao salvar no Mongo");
  return j;
}

document.addEventListener("click", async (ev) => {
        console.log('');
        try{
                const btn = ev.target.closest(".btnUpload");
                  if (!btn) return;
                  
                  const slotId = btn.dataset.id; 
                  if (!slotId) return alert("slotId não veio no botão (data-id).");

                  const card = btn.closest(".card"); 
                  if (!card) return alert("Não achei o card (data-slot-id).");
                
                  const fileInput = card.querySelector(".slotFile");
                  if (!fileInput) return alert("Não achei o input .slotFile.");
                
                  const file = fileInput.files?.[0];
                  if (!file) return alert("Escolha um ficheiro primeiro!");


                  // 1) upload spaces via presigned (você já tem isso)
                  const urlPublica = await uploadToSpacesHomeViaPresigned(file, /*ordem etc se quiser*/);

                  // 2) salva no mongo via JSON
                  await salvarFotoNoSlot({ slotId, imgUrl: urlPublica });

                  // 3) atualiza preview sem recarregar (se houver img dentro do card)
                  const img = card.querySelector("img");
                  if (img) img.src = urlPublica;

                  const lbl = card.querySelector(".url-atual");
                  if (lbl) lbl.textContent = urlPublica;

                  btn.textContent = "Enviado ✔";
                  setTimeout(() => (btn.textContent = "Enviar foto (PC) e salvar"), 1500);
          } catch (err) {
                  console.log(err);
                  alert(err.message || "Erro ao enviar/salvar foto.");
          } finally {
                  ev.target.closest(".btnEnviarFoto").disabled = false;
          }
});
