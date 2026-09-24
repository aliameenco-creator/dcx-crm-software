export function validateProposal(input) {
  if(!input || typeof input!=='object' || Array.isArray(input))throw new Error('Invalid proposal.');
  const content={};
  for(const key of ['title','introduction','scope','deliverables','timeline','commercial_terms','exclusions']) {
    if(typeof input[key]!=='string'||input[key].length>(key==='title'?200:10000))throw new Error(`Invalid ${key.replaceAll('_',' ')}.`);
    content[key]=input[key].trim();
  }
  if(!content.title||!content.scope)throw new Error('Enter a proposal title and scope.');
  return content;
}
