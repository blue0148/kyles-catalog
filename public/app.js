let selected = null;
let token = sessionStorage.getItem("kyleAdmin") || "";

const $ = id => document.getElementById(id);
async function api(url, opts={}) {
  const headers = {"Content-Type":"application/json", ...(opts.headers||{})};
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(url, {...opts, headers});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

async function loadCatalog(){
  const items = await api("/api/catalog");
  $("catalog").innerHTML = items.map(x => `
    <article class="card ${x.available<=0?"sold":""}">
      <h3>${esc(x.name)}</h3>
      <div class="desc">${esc(x.description)}</div>
      <div class="price">${esc(x.price)}</div>
      <div class="stock">${x.available>0 ? `${x.available} available` : "Sold out"}</div>
      <button ${x.available<=0?"disabled":""} onclick="selectItem(${x.id},'${esc(x.name)}')">
        ${x.available>0?"Preorder":"Unavailable"}
      </button>
    </article>`).join("");
}
function selectItem(id,name){
  selected=id; $("selectedText").textContent="Selected: "+name;
  $("name").focus(); window.scrollTo({top:$("orderForm").offsetTop-100,behavior:"smooth"});
}
$("orderForm").addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    await api("/api/preorder",{method:"POST",body:JSON.stringify({name:$("name").value,itemId:selected})});
    $("message").textContent="You're on the list!";
    $("name").value=""; selected=null; $("selectedText").textContent="Choose an item above.";
    await loadCatalog();
  }catch(err){$("message").textContent=err.message}
});
$("login").onclick=async()=>{
  try{
    const d=await api("/api/admin/login",{method:"POST",body:JSON.stringify({password:$("password").value})});
    token=d.token; sessionStorage.setItem("kyleAdmin",token);
    $("loginBox").hidden=true; $("adminPanel").hidden=false; loadAdmin();
  }catch(e){alert(e.message)}
};
async function loadAdmin(){
  const items=await api("/api/catalog"), orders=await api("/api/admin/orders");
  $("adminItems").innerHTML=items.map(x=>`
    <div class="admin-item">
      <form onsubmit="saveItem(event,${x.id})">
        <input name="name" value="${esc(x.name)}" placeholder="Name">
        <input name="description" value="${esc(x.description)}" placeholder="Description">
        <input name="price" value="${esc(x.price)}" placeholder="Price">
        <input name="qty" type="number" min="0" value="${x.available}" placeholder="Daily qty">
        <button>Save</button>
        <button type="button" class="danger" onclick="deleteItem(${x.id})">Delete</button>
      </form>
    </div>`).join("");
  $("orders").innerHTML=orders.length?orders.map(o=>`<div class="order"><b>${esc(o.name)}</b> — ${esc(o.item_name)} <span class="muted">(${new Date(o.created_at).toLocaleString()})</span></div>`).join(""):"<p class='muted'>No preorders yet.</p>";
}
async function saveItem(e,id){
  e.preventDefault(); const f=e.target;
  try{await api("/api/admin/catalog",{method:"POST",body:JSON.stringify({id,name:f.name.value,description:f.description.value,price:f.price.value,dailyQuantity:f.qty.value})});loadAdmin();loadCatalog()}
  catch(e){alert(e.message)}
}
async function deleteItem(id){if(confirm("Delete this item?")){await api("/api/admin/catalog/"+id,{method:"DELETE"});loadAdmin();loadCatalog()}}
$("newItem").onclick=async()=>{
  const name=prompt("Item name?"); if(!name)return;
  const description=prompt("Description?")||"", price=prompt("Price?")||"", qty=Number(prompt("Daily quantity?")||0);
  await api("/api/admin/catalog",{method:"POST",body:JSON.stringify({name,description,price,dailyQuantity:qty})});loadAdmin();loadCatalog();
};
$("reset").onclick=async()=>{if(confirm("Reset all availability to daily quantities?")){await api("/api/admin/reset",{method:"POST"});loadAdmin();loadCatalog()}};
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
loadCatalog();
if(token){$("loginBox").hidden=true;$("adminPanel").hidden=false;loadAdmin()}
