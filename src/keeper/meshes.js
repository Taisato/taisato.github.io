import { FT } from "../../vendor/three.js";

/* Prebaked smooth keeper geometry. Positions: 16-bit bounds; normals: octahedral. */
class FootballKeeperMeshes {
  static data=null;
  static _loading=null;
  static load(){
    if(this.data)return Promise.resolve(this.data);
    if(this._loading)return this._loading;
    this._loading=(async()=>{
      const url=new URL('../../assets/models/keeper/keeper.json',import.meta.url);
      const response=await fetch(url);
      if(!response.ok)throw new Error('Keeper metadata: HTTP '+response.status);
      const metadata=await response.json();
      if(metadata.format!=='first-touch-keeper-v1')throw new Error('Unsupported keeper model');
      const entries=await Promise.all(['body','gloveR'].map(async name=>{
        const m=metadata.meshes?.[name];
        if(!m||!Number.isInteger(m.vertices)||m.vertices<=0||m.vertices>65535||
           !Number.isInteger(m.count)||m.count<=0||m.count%3||typeof m.skin!=='boolean'||
           !Array.isArray(m.min)||!Array.isArray(m.span)||m.min.length!==3||m.span.length!==3||
           !m.min.every(Number.isFinite)||!m.span.every(v=>Number.isFinite(v)&&v>0)||typeof m.file!=='string')
          throw new Error('Invalid keeper metadata: '+name);
        const expected=m.vertices*(m.skin?18:14)+m.count*2;
        if(m.byteLength!==expected)throw new Error('Invalid keeper byte count: '+name);
        const asset=await fetch(new URL(m.file,url));
        if(!asset.ok)throw new Error('Keeper '+name+': HTTP '+asset.status);
        const bytes=new Uint8Array(await asset.arrayBuffer());
        if(bytes.byteLength!==expected)throw new Error('Incomplete keeper model: '+name);
        return [name,{...m,bytes}];
      }));
      this.data=Object.fromEntries(entries);
      return this.data;
    })().catch(error=>{this._loading=null;throw error;});
    return this._loading;
  }
  static create(name){
    const mirror=name==='gloveL',m=this.data?.[mirror?'gloveR':name];
    if(!m)throw new Error('Keeper mesh unavailable; load assets before creating the game.');
    const bytes=m.bytes;
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),position=new Float32Array(m.vertices*3),normal=new Float32Array(m.vertices*3),uv=new Float32Array(m.vertices*2),index=new Uint16Array(m.count);
    const skinIndex=m.skin?new Uint16Array(m.vertices*4):null,skinWeight=m.skin?new Float32Array(m.vertices*4):null;let offset=0;
    const u16=()=>{const value=view.getUint16(offset,true);offset+=2;return value;};
    for(let i=0;i<m.vertices;i++){
      for(let j=0;j<3;j++)position[i*3+j]=m.min[j]+u16()/65535*m.span[j];
      let x=view.getInt16(offset,true)/32767,y=view.getInt16(offset+2,true)/32767;offset+=4;
      const z=1-Math.abs(x)-Math.abs(y);
      if(z<0){const oldX=x;x=(1-Math.abs(y))*(x<0?-1:1);y=(1-Math.abs(oldX))*(y<0?-1:1);}
      const length=Math.hypot(x,y,z);normal[i*3]=x/length;normal[i*3+1]=y/length;normal[i*3+2]=z/length;
      uv[i*2]=u16()/65535;uv[i*2+1]=u16()/65535;
      if(m.skin){skinIndex[i*4]=view.getUint8(offset++);skinIndex[i*4+1]=view.getUint8(offset++);const weight=u16()/65535;skinWeight[i*4]=weight;skinWeight[i*4+1]=1-weight;}
      if(mirror){position[i*3]*=-1;normal[i*3]*=-1;}
    }
    for(let i=0;i<m.count;i++)index[i]=u16();
    if(mirror)for(let i=0;i<m.count;i+=3){const b=index[i+1];index[i+1]=index[i+2];index[i+2]=b;}
    const geometry=new FT.BufferGeometry();geometry.setAttribute('position',new FT.BufferAttribute(position,3));geometry.setAttribute('normal',new FT.BufferAttribute(normal,3));geometry.setAttribute('uv',new FT.BufferAttribute(uv,2));geometry.setIndex(new FT.BufferAttribute(index,1));
    if(m.skin){geometry.setAttribute('skinIndex',new FT.BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new FT.BufferAttribute(skinWeight,4));}
    geometry.computeBoundingSphere();return geometry;
  }
}

export { FootballKeeperMeshes };
