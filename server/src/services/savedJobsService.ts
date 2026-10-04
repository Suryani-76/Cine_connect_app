import { supabase } from '../db/supabase'

export async function saveJob(jobId: string, talentProfileId: string): Promise<void> {
  const { error } = await supabase.from('saved_jobs')
    .upsert({ job_id: jobId, talent_profile_id: talentProfileId }, { onConflict: 'job_id,talent_profile_id', ignoreDuplicates: true })
  if (error && error.code !== '23505') throw Object.assign(new Error(error.message), { statusCode: 500 })
}

export async function unsaveJob(jobId: string, talentProfileId: string): Promise<void> {
  const { error } = await supabase.from('saved_jobs')
    .delete().eq('job_id', jobId).eq('talent_profile_id', talentProfileId)
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
}

export async function getSavedJobs(talentProfileId: string): Promise<any[]> {
  const { data, error } = await supabase.from('saved_jobs')
    .select('id, job_id, created_at, jobs(id, title, description, status, job_type, pay_min, pay_max, pay_currency, pay_period, deadline, created_at, production_id, job_requirements(skills, roles, location), production_profiles(company_name, logo_url, verified))')
    .eq('talent_profile_id', talentProfileId)
    .order('created_at', { ascending: false })
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
  return data ?? []
}
