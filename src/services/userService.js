import { supabase } from "./supabase";

export const createStaff = async ({ email, password, name, dept }) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;

  const user = data.user;

  const { error: insertError } = await supabase.from("staff").insert([
    {
      name,
      dept,
      role: "staff",
      user_id: user.id,
    },
  ]);

  if (insertError) throw insertError;

  return user;
};