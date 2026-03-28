
import { registerService } from './mcp-server';

registerService('SagaService', {
  EmbarkQuest: async (args) => {
    return { 
      success: true, 
      message: "Hero " + args.hero_id + " embarked to " + args.location, 
      rewards: ['XP', 'Gold'] 
    };
  }
});
