import { UserNeeds } from '../types/userNeeds';
import { recommendationService } from '../services/recommendationService';
import { RecommendationEngineResult } from '../types/recommendation';

export function getAgentRecommendations(needs: UserNeeds): RecommendationEngineResult {
  return recommendationService.recommendProducts(needs);
}
