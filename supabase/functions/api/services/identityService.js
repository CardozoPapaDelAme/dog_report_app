export function getCurrentProfile(auth) {
  return {
    user_id: auth.userId,
    role: auth.role,
    display_name: auth.profile.display_name,
    active: auth.profile.active,
  };
}