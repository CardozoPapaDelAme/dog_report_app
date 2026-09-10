import {getCurrentProfile} from '../services/identity-service.js';
import { presentIdentity } from '../presenters/identify-presenter.js';


export async function getCurrentProfileController(c) {
  const auth = c.get('auth');
  const profile = getCurrentProfile(auth);
  return presentIdentity(c, profile);
}