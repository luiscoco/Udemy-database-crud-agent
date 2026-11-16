import { Agent, type Model } from '@openai/agents';
import { type AppContext, type ProductRepository } from './domain.js';
import { createInventoryTools, type MutationReceipt } from './tools.js';

import { INVENTORY_INSTRUCTIONS } from './inventory-instructions.js';
export { INVENTORY_INSTRUCTIONS } from './inventory-instructions.js';

export function createInventoryAgent(
  repository: ProductRepository,
  model: string | Model,
  onMutation?: (receipt: MutationReceipt) => void,
) {
  return new Agent<AppContext>({
    name: 'Inventory Database Agent',
    model,
    instructions: INVENTORY_INSTRUCTIONS,
    modelSettings: { parallelToolCalls: false, maxTokens: 2000 },
    tools: createInventoryTools(repository, onMutation),
  });
}
