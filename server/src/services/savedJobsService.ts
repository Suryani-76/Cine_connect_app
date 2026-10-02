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

export async function getSavedJobs(talentProfileId: string): Promise<{ job_id: string }[]> {
  const { data, error } = await supabase.from('saved_jobs')
    .select('job_id').eq('talent_profile_id', talentProfileId)
  if (error) throw Object.assign(new Error(error.message), { statusCode: 500 })
  return (data ?? []) as { job_id: string }[]
}
