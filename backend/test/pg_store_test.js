// Verifica el adaptador Postgres con pglite (Postgres real en proceso)
process.env.DATABASE_URL = 'postgres://test'; // activa modo PG
const { PGlite } = require('/sessions/focused-stoic-lovelace/mnt/outputs/node_modules/@electric-sql/pglite');
const store = require('/sessions/focused-stoic-lovelace/mnt/Mimitu/backend/src/store');
let pass=0,fail=0; const ok=(c,m)=>{c?pass++:(fail++,console.log('  ✗ '+m));};
(async()=>{
  const db = new PGlite();
  store.setQueryFn((sql,params)=>db.query(sql,params));
  ok(store.isPostgres===true,'PG mode active');
  await store.init();
  // insertar datos
  store.collection('users').insert({id:'u_1',name:'Ale',balance:0});
  store.collection('couples').insert({id:'cp_1',code:'ABC123',premium:false});
  store.collection('users').update(x=>x.id==='u_1',{balance:30});
  await store.flush();
  // simular reinicio: re-init recarga desde pglite
  await store.init();
  const u = store.collection('users').findOne(x=>x.id==='u_1');
  ok(u && u.balance===30,'user persisted with balance 30 (got '+(u&&u.balance)+')');
  const c = store.collection('couples').findOne(x=>x.code==='ABC123');
  ok(!!c,'couple persisted');
  // verificar que quedó en la tabla kv
  const raw = await db.query("SELECT name, jsonb_array_length(data) AS n FROM kv ORDER BY name");
  const usersRow = raw.rows.find(r=>r.name==='users');
  ok(usersRow && Number(usersRow.n)===1,'kv table holds users array');
  // remove + persist
  store.collection('users').remove(x=>x.id==='u_1');
  await store.flush();
  await store.init();
  ok(store.collection('users').find(()=>true).length===0,'remove persisted');
  console.log('\nPG STORE: '+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
