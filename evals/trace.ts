/** Agents SDK results wrap JSON tool payloads in a text content item. */
export function toolResults(history: any[]): any[] {
  return history.filter(item=>item.type==='function_call_result').flatMap(item=>{
    const output = item.output;
    const text = typeof output==='string'?output:output?.type==='text'?output.text:undefined;
    if (typeof text!=='string') return [];
    try { return [JSON.parse(text)]; } catch { return []; }
  });
}
