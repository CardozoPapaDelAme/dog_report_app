import {getCurrentProfile} from '../services/identityService.js';
import { presentIdentity } from '../presenters/identityPresenter.js';


export async function getCurrentProfileController(c) {
  const auth = c.get('auth');
  const profile = getCurrentProfile(auth);
  return presentIdentity(c, profile);
}
