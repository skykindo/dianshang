import assert from "node:assert/strict";
import test from "node:test";

const env={ASSETS:{fetch:async()=>new Response("Not found",{status:404})}};
const ctx={waitUntil(){},passThroughOnException(){}};
async function worker(){const url=new URL("../dist/server/index.js",import.meta.url);url.searchParams.set("catalog",`${Date.now()}-${Math.random()}`);return(await import(url.href)).default;}
async function json(w,path,init){const response=await w.fetch(new Request(`http://localhost${path}`,init),env,ctx);return{response,body:await response.json()};}
const body=(method,value)=>({method,headers:{"content-type":"application/json"},body:JSON.stringify(value)});

test("商品 CRUD 与 Agent Tool 读取同一份数据",async()=>{
  const w=await worker();
  const created=await json(w,"/api/catalog",body("POST",{sku:"SNK-TEST-901",name:"榛子小包",category:"坚果",price:16.8,spec:"20g*5包",tasteTags:["榛子"],sceneTags:["办公室"],packageTags:["便携"],peopleTags:["大众"],avoidTags:["坚果过敏慎选"],sellingPoints:["独立小包"],stockStatus:"in_stock",costPrice:8,grossMargin:0.524,notes:""}));
  assert.equal(created.response.status,201);
  assert.equal(created.body.product.grossMargin,0.5238);
  const searched=await json(w,"/api/tools/catalog-search/test",body("POST",{input:{question:"推荐榛子"}}));
  assert.equal(searched.response.status,200);
  assert.deepEqual(searched.body.output.items.map(item=>item.sku),["SNK-TEST-901"]);
  const updated=await json(w,"/api/catalog/SNK-TEST-901",body("PUT",{...created.body.product,price:18.8,stockStatus:"low_stock"}));
  assert.equal(updated.response.status,200);assert.equal(updated.body.product.price,18.8);assert.equal(updated.body.product.grossMargin,0.5745);assert.equal(updated.body.product.stockStatus,"low_stock");
  const removed=await json(w,"/api/catalog/SNK-TEST-901",{method:"DELETE"});assert.equal(removed.response.status,200);
  const list=await json(w,"/api/catalog");assert.equal(list.body.products.some(item=>item.sku==="SNK-TEST-901"),false);
});
