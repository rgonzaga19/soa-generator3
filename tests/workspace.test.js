const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
for(const page of ['index','batch']) test(`${page} workspace navigation and theme controls`,async()=>{
 const html=fs.readFileSync(`public/${page}.html`,'utf8');const nodes=new Map();
 function element(dataset={}){const classes=new Set();return {dataset,style:{},attributes:{},classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},toggle(c,on){on?classes.add(c):classes.delete(c)},contains(c){return classes.has(c)}},innerHTML:'',value:'',textContent:'',children:[],title:'',setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},removeAttribute(k){delete this.attributes[k]},addEventListener(name,fn){this[name]=fn},appendChild(n){this.children.push(n)}};}
 for(const m of html.matchAll(/id="([^"]+)"/g)){assert.ok(!nodes.has(m[1]),`Duplicate ID ${m[1]}`);nodes.set(m[1],element());}
 const choices=['light','dark'].map(themeChoice=>element({themeChoice}));const nav=['individual','batch','settings','about'].map(view=>element({view}));const container=element();const root=element();const body=element();root.setAttribute('data-theme','light');const errors=[];const storage={};
 const context=vm.createContext({document:{body,getElementById:id=>nodes.get(id)||null,querySelector:()=>container,querySelectorAll:q=>q==='[data-theme-choice]'?choices:nav,createElement:element,documentElement:root},window:{scrollTo(){},electronAPI:{getAppVersion:async()=> '2.0.5',getLicenseKey:async()=> ''}},localStorage:{getItem:k=>storage[k]||null,setItem(k,v){storage[k]=v}},console:{log(){},error:e=>errors.push(String(e))},setTimeout,clearTimeout,AbortController,fetch:async()=>{throw Error('Unexpected fetch')}});
 vm.runInContext(fs.readFileSync('public/js/app.js','utf8'),context);await new Promise(r=>setTimeout(r,10));assert.deepEqual(errors,[]);
 await vm.runInContext('openSettingsModal()',context);assert.equal(container.hidden,true);assert.equal(nodes.get('settingsModal').style.display,'block');
 choices[1].click();assert.equal(root.getAttribute('data-theme'),'dark');assert.equal(nodes.get('themeToggleBtn').getAttribute('aria-checked'),'true');
 nodes.get('themeToggleBtn').click();assert.equal(choices[0].getAttribute('aria-pressed'),'true');
 nodes.get('sidebarToggleBtn').click();assert.equal(body.classList.contains('sidebar-collapsed'),true);assert.equal(storage.soaSidebarCollapsed,'true');assert.equal(nodes.get('sidebarToggleBtn').getAttribute('aria-expanded'),'false');
 nodes.get('sidebarToggleBtn').click();assert.equal(body.classList.contains('sidebar-collapsed'),false);assert.equal(storage.soaSidebarCollapsed,'false');assert.equal(nodes.get('sidebarToggleBtn').getAttribute('aria-expanded'),'true');
 vm.runInContext("showWorkspaceView('about')",context);assert.equal(nodes.get('settingsModal').style.display,'none');assert.equal(nodes.get('aboutModal').style.display,'block');
 vm.runInContext('closeSettingsModal()',context);assert.equal(container.hidden,false);
 assert.ok(html.includes('appearance-section'));
 assert.equal(vm.runInContext('appState.claims.length',context),1);
});
