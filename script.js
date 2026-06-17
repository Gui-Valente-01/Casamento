const dados = window.siteCasamento;

document.title = `${dados.noiva} e ${dados.noivo}`;
document.querySelector("#casal").textContent = `${dados.noiva} & ${dados.noivo}`;
document.querySelector("#data").textContent = dados.data;
document.querySelector("#horario").textContent = dados.horario;
document.querySelector("#local").textContent = dados.local;
document.querySelector("#endereco").textContent = dados.endereco;
document.querySelector("#recado").textContent = dados.recado;

const mensagem = encodeURIComponent(
  `Oi! Quero confirmar presença no casamento de ${dados.noiva} e ${dados.noivo}.`
);

document.querySelector("#whatsapp").href = `https://wa.me/${dados.whatsapp}?text=${mensagem}`;
