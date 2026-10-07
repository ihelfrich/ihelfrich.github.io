export async function decodeVelocityBytes(bytes,compression){
  const header=new Uint8Array(bytes,0,Math.min(2,bytes.byteLength));
  // Some static hosts mark .gz files with Content-Encoding and fetch has
  // already decoded them; others return the compressed file unchanged.
  if(compression==='gzip'&&header[0]===0x1f&&header[1]===0x8b)return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return bytes;
}
