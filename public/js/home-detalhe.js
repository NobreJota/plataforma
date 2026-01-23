// public/js/home-detalhe.js
(function () {
  "use strict";
console.log("home-detalhe.js carregou");
console.log("pageurls:", window.__PRODUTO__?.pageurls);

  // ==================== PRODUTO + IMAGENS ====================
  const P = window.__PRODUTO__ || {};
  
  const imgs = Array.isArray(P.pageurls) ? P.pageurls.slice(0, 7) : [];
  console.log(imgs)
          

  const imgPrincipal = document.getElementById("imgPrincipal");
  const placeholder = document.getElementById("fotoPlaceholder");
  const thumbs = Array.from(document.querySelectorAll(".thumb-slot"));

  function setPrincipal(url) {
    if (!imgPrincipal || !placeholder) return;

    if (!url) {
      imgPrincipal.style.display = "none";
      placeholder.style.display = "flex";
      return;
    }
    imgPrincipal.src = url;
    imgPrincipal.style.display = "block";
    placeholder.style.display = "none";
  }

  function setThumb(slot, url) {
    const img = slot.querySelector(".thumb-img");
    const empty = slot.querySelector(".thumb-empty");
    if (!img || !empty) return;

    if (url) {
      img.src = url;
      img.style.display = "block";
      empty.style.display = "none";
    } else {
      img.removeAttribute("src");
      img.style.display = "none";
      empty.style.display = "block";
    }
  }

  function setActive(idx) {
    thumbs.forEach((b) => b.classList.remove("active"));
    const btn = thumbs[idx];
    if (btn) btn.classList.add("active");
  }

  thumbs.forEach((btn, idx) => {
    setThumb(btn, imgs[idx]);
    btn.addEventListener("click", () => {
      setPrincipal(imgs[idx]);
      setActive(idx);
    });
  });

  setPrincipal(imgs[0] || "");
  setActive(0);

  // ==================== WHATSAPP (NÃO DUPLICA) ====================
  // Você JÁ monta no backend: whatsappLink
  const btnFloat = document.getElementById("btnWhatsFloat");
  const urlWhats = (window.__WHATSAPP_LINK__ || "").trim();

  if (btnFloat) {
    if (!urlWhats || urlWhats === "#") {
      //btnFloat.style.display = "none";
    } else {
      btnFloat.href = urlWhats;
      btnFloat.target = "_blank";
      btnFloat.rel = "noopener";
      // se quiser só ícone (sem texto), o CSS resolve — não precisa innerHTML aqui
    }
  }

  const btnInline = document.getElementById("btnWhatsInline");
  if (btnInline) {
    if (!urlWhats || urlWhats === "#") {
      btnInline.style.display = "none";
    } else {
      btnInline.href = urlWhats;
      btnInline.target = "_blank";
      btnInline.rel = "noopener";
    }
  }

  // ==================== PEDIDO (API - COMPATÍVEL COM SUA MODEL) ====================
  const btnAdd = document.getElementById("btnAddLista");
  const pedidoRows = document.getElementById("pedidoRows");
  const pedidoTotal = document.getElementById("pedidoTotal");

  function moeda(n) {
    const num = Number(n || 0);
    return num.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts,
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 401) throw new Error("NAO_LOGADO");
    if (!res.ok || data.ok === false) throw new Error(data.msg || "Erro na API");

    return data;
  }

  function renderTable(itens, total) {
    if (!pedidoRows) return;

    pedidoRows.innerHTML = "";

    // se a sua <tbody> está dentro de <table>, aqui precisa ser <tr>
    itens.forEach((it) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${it.codigo || ""}</td>
        <td>${it.descricao || ""}</td>
        <td>${it.lojaNome || ""}</td>
        <td>R$ ${moeda(it.preco)}</td>
        <td>R$ ${moeda(it.preco)}</td>
        <td>
          <input type="checkbox" ${it.ativo ? "checked" : ""} data-toggle="${it.produto}">
        </td>
      `;
      pedidoRows.appendChild(tr);
    });

    if (pedidoTotal) pedidoTotal.textContent = moeda(total || 0);

    pedidoRows.querySelectorAll("[data-toggle]").forEach((chk) => {
      chk.addEventListener("change", async () => {
        const produtoId = chk.getAttribute("data-toggle");
        await api(`/pedido/item/${produtoId}/toggle`, { method: "PATCH" });
        await carregarPedido();
      });
    });
  }

  async function carregarPedido() {
    const btnLoginTopo = document.getElementById("btnLoginTopo");
    try {
      const data = await api("/pedido");
      renderTable(data.itens || [], data.total || 0);
      if (btnAdd) btnAdd.disabled = false;
    } catch (e) {
      if(btnLoginTopo) btnLoginTopo.style.display = "inline-flex";
      if (e.message === "NAO_LOGADO") {
        if (pedidoRows) {
          // tbody aceita <tr>, então coloca assim:
          pedidoRows.innerHTML = `
            <tr>
              <td colspan="6" style="padding:10px;color:#111ddd;">Faça login para usar o Lista.</td>
            </tr>
          `;
        }
        if (pedidoTotal) pedidoTotal.textContent = "0,00";
        if (btnAdd) btnAdd.disabled = true;
        return;
      }
      console.error(e);
    }
  }

  if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
      const produtoId = btnAdd.getAttribute("data-produto-id");
      if (!produtoId) return;

      try {
        await api("/pedido/add", {
          method: "POST",
          body: JSON.stringify({ produtoId }),
        });
        await carregarPedido();
      } catch (e) {
        if (e.message === "NAO_LOGADO") return alert("Faça login para adicionar no pedido.");
        alert("Erro ao adicionar no pedido.");
      }
    });
  }

  if (window.__LOGADO__) carregarPedido();
else {
  // mantém seu comportamento de “Faça login...”
  const btnLoginTopo = document.getElementById("btnLoginTopo");
  if (btnLoginTopo) btnLoginTopo.style.display = "inline-flex";

  if (pedidoRows) {
    pedidoRows.innerHTML = `
      <tr>
        <td colspan="6" style="padding:10px;color:#111ddd;">Faça login para usar o Lista.</td>
      </tr>
    `;
  }
  if (pedidoTotal) pedidoTotal.textContent = "0,00";
  if (btnAdd) btnAdd.disabled = true;
}
})();

// })();
