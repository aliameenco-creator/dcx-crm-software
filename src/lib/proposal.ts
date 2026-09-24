export type ProposalContent = {title:string;introduction:string;scope:string;deliverables:string;timeline:string;commercial_terms:string;exclusions:string};
export type Proposal = {id:string;customer_id:string;title:string;customer_snapshot:{name:string;contact?:string;email?:string;phone?:string;billing_address?:string};content:ProposalContent;template_key:string;version:number;created_at:string;updated_at:string};
export const proposalSections: [keyof ProposalContent,string][]=[['introduction','Introduction'],['scope','Scope of work'],['deliverables','Deliverables'],['timeline','Timeline'],['commercial_terms','Commercial terms'],['exclusions','Assumptions and exclusions']];
export const emptyProposal=():ProposalContent=>({title:'Service proposal',introduction:'',scope:'',deliverables:'',timeline:'',commercial_terms:'',exclusions:''});

export async function buildProposalPdf(proposal:Proposal) {
  const {jsPDF}=await import('jspdf');const doc=new jsPDF();let y=24;
  const header=()=>{doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(34,70,62);doc.text('DCX TECHNICAL INC. | PROPOSAL',18,15);doc.setDrawColor(210,220,215);doc.line(18,19,192,19);y=28;};
  const text=(value:string,size=11,bold=false)=>{
    doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(30,42,48);
    const lines:string[]=doc.splitTextToSize(value,174);
    for(const line of lines){if(y>272){doc.addPage();header();doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(30,42,48);}doc.text(line,18,y);y+=size*.48;}y+=4;
  };
  header();text(proposal.title,22,true);text(`Proposal ${proposal.id.slice(0,8).toUpperCase()} | Version ${proposal.version} | ${proposal.created_at.slice(0,10)}`,9);
  text('PREPARED FOR',10,true);text([proposal.customer_snapshot.name,proposal.customer_snapshot.contact,proposal.customer_snapshot.email,proposal.customer_snapshot.phone,proposal.customer_snapshot.billing_address].filter(Boolean).join('\n'));
  for(const [key,label] of proposalSections){if(!proposal.content[key])continue;if(y>250){doc.addPage();header();}text(label,13,true);text(proposal.content[key]);}
  const count=doc.getNumberOfPages();for(let i=1;i<=count;i++){doc.setPage(i);doc.setFontSize(9);doc.setTextColor(100);doc.text(`Prepared proposal | ${i} / ${count}`,18,286);}
  return doc;
}
export async function exportProposalPdf(proposal:Proposal){const doc=await buildProposalPdf(proposal);doc.save(`proposal-${proposal.id.slice(0,8)}-v${proposal.version}.pdf`);}
