// Small PostgREST-shaped adapter backed by actual PostgreSQL for API integration tests.
export function trackingDb(pg) {
  const wrap = async fn => { try { return {data:await fn(),error:null}; } catch(error) { return {data:null,error}; } };
  return {
    rpc(name,args) { return wrap(async()=> (await pg.query(`select ${name}(${Object.keys(args).map((_,i)=>`$${i+1}`).join(',')}) result`,Object.values(args).map(v=>typeof v==='object'?JSON.stringify(v):v))).rows[0].result); },
    from(table) {
      let fields='*',data,mode='select',conflict,limit,orders=[],conditions=[],values=[];
      const bind=v=>{values.push(typeof v==='object'&&v!==null?JSON.stringify(v):v);return '$'+values.length;};
      const run=()=>wrap(async()=>{
        let sql;
        if(mode==='select')sql=`select ${fields} from ${table}`;
        if(mode==='upsert'||mode==='insert') {
          const entries=Object.entries(data);
          sql=`insert into ${table}(${entries.map(([k])=>k)}) values(${entries.map(([,v])=>bind(v))})`;
          if(mode==='upsert')sql+=` on conflict(${conflict}) do update set ${entries.map(([k])=>`${k}=excluded.${k}`).join(',')}`;
        }
        if(mode==='update')sql=`update ${table} set ${Object.entries(data).map(([k,v])=>`${k}=${bind(v)}`).join(',')}`;
        if(conditions.length)sql+=' where '+conditions.join(' and ');
        if(mode==='select') {if(orders.length)sql+=' order by '+orders.join(',');if(limit)sql+=' limit '+limit;}
        else sql+=' returning '+fields;
        return (await pg.query(sql,values)).rows;
      });
      const query={
        select(f='*'){fields=f;return query;},
        eq(k,v){conditions.push(`${k}=${bind(v)}`);return query;},
        neq(k,v){conditions.push(`${k}<>${bind(v)}`);return query;},
        gt(k,v){conditions.push(`${k}>${bind(v)}`);return query;},
        order(k,o={}){orders.push(k+(o.ascending===false?' desc':' asc'));return query;},
        limit(n){limit=n;return query;},
        upsert(row,options){mode='upsert';data=row;conflict=options.onConflict;return query;},
        insert(row){mode='insert';data=row;return query;},
        update(row){mode='update';data=row;return query;},
        async single(){const r=await run();return {...r,data:r.data?.[0]};},
        async maybeSingle(){const r=await run();return {...r,data:r.data?.[0]||null};},
        then(resolve,reject){return run().then(resolve,reject);}
      };return query;
    }
  };
}
