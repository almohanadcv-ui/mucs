import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { api, type ManagedTask } from '../api';
type Change = {action:string;id?:string;title?:string;completed?:boolean};
export function TaskChecklist({task,canManage,canUpdate,onSaved,confirm}:{task:ManagedTask;canManage:boolean;canUpdate:boolean;onSaved:()=>Promise<void>;confirm:(message:string,action:()=>Promise<void>)=>void}) {
  const [title,setTitle]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const [editing,setEditing]=useState<string|null>(null); const [editedTitle,setEditedTitle]=useState('');
  const items=task.checklist ?? [];
  const finished=items.filter(item=>item.completed).length;
  const locked=['done','under_review'].includes(task.status) || Boolean(task.actionRequest) || task.allocationRequest?.state==='pending';
  async function update(body:Change) {
    setBusy(true);setError('');
    try {await api.updateChecklist(task.id,body);if(body.action==='add')setTitle('');setEditing(null);await onSaved();}
    catch(error){setError(error instanceof Error ? error.message : 'Could not update work steps.');}finally{setBusy(false);}
  }
  return <section className="task-checklist" aria-label="Task completion checklist"><header><strong>Work completion: {task.progress}%</strong><small>{items.length ? `${finished} of ${items.length} optional steps complete` : task.status==='done' ? 'Approved and completed' : task.status==='under_review' ? 'Submitted as complete, awaiting approval' : 'Add work steps to measure completion'}</small></header>
    <p>Optional work steps guide progress; they do not block finishing the task. Each step counts equally. Submission and final approval are tracked separately.</p>
    <ul>{items.map(item=><li key={item.id}>{editing===item.id?<div className="checklist-edit"><input aria-label="Edit work step" maxLength={200} value={editedTitle} onChange={event=>setEditedTitle(event.target.value)}/><button className="icon-button" type="button" disabled={busy||!editedTitle.trim()} aria-label="Save step" onClick={()=>void update({action:'edit',id:item.id,title:editedTitle})}><Check size={15}/></button><button className="icon-button" type="button" aria-label="Cancel editing" onClick={()=>setEditing(null)}><X size={15}/></button></div>:<><label><input type="checkbox" checked={item.completed} disabled={!canUpdate||locked||busy} onChange={event=>{const completed=event.target.checked;confirm(completed ? `Are you sure "${item.title}" is finished?` : `Mark "${item.title}" as unfinished?`,()=>update({action:'toggle',id:item.id,completed}));}}/><span>{item.title}</span></label>{canManage&&!locked?<div className="checklist-item-actions"><button className="icon-button" type="button" disabled={busy} aria-label={`Edit step: ${item.title}`} onClick={()=>{setEditing(item.id);setEditedTitle(item.title);}}><Pencil size={14}/></button><button className="icon-button danger" type="button" disabled={busy} aria-label={`Remove step: ${item.title}`} onClick={()=>confirm(`Remove "${item.title}"? Progress will be recalculated.`,()=>update({action:'delete',id:item.id}))}><Trash2 size={14}/></button></div>:null}</>}</li>)}</ul>
    {canManage&&!locked?<div className="checklist-add"><input aria-label="New work step" placeholder="Add a step, e.g. Prepare drawings" maxLength={200} value={title} disabled={busy} onChange={event=>setTitle(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&title.trim()){event.preventDefault();void update({action:'add',title});}}}/><button type="button" className="ghost-button" disabled={busy||!title.trim()} onClick={()=>void update({action:'add',title})}>Add step</button></div>:null}
    {error?<p role="alert">{error}</p>:null}
  </section>;
}
