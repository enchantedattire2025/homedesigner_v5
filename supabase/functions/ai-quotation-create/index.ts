import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

interface CreateRequest {
  projectId: string
  sourceFilePath: string
  sourceFileType: 'application/pdf' | 'image/jpeg' | 'image/png'
  sourceFileSize: number
  requirementsText: string
  pricingProfile?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return json({ error: 'Authentication required' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return json({ error: 'Service unavailable' }, 503)

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser(token)
    if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

    const body = await req.json() as CreateRequest
    if (!body.projectId || !body.sourceFilePath || !body.sourceFileType || !body.sourceFileSize) {
      return json({ error: 'Incomplete quotation request' }, 400)
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(body.sourceFileType)) {
      return json({ error: 'Unsupported floor plan type' }, 400)
    }
    if (!Number.isInteger(body.sourceFileSize) || body.sourceFileSize < 1 || body.sourceFileSize > 10 * 1024 * 1024) {
      return json({ error: 'Floor plan must be smaller than 10 MB' }, 400)
    }

    const { data: designer, error: designerError } = await userClient
      .from('designers')
      .select('id')
      .eq('user_id', userData.user.id)
      .maybeSingle()
    if (designerError || !designer) return json({ error: 'Designer access required' }, 403)

    const firstFolder = body.sourceFilePath.split('/')[0]
    if (firstFolder !== designer.id) return json({ error: 'Invalid floor plan location' }, 400)

    const { data: project, error: projectError } = await userClient
      .from('customers')
      .select('id, assigned_designer_id')
      .eq('id', body.projectId)
      .eq('assigned_designer_id', designer.id)
      .maybeSingle()
    if (projectError || !project) return json({ error: 'Project access required' }, 403)

    const jobId = crypto.randomUUID()
    const { error: insertError } = await userClient.from('ai_quotation_jobs').insert({
      id: jobId,
      designer_id: designer.id,
      project_id: project.id,
      source_file_path: body.sourceFilePath,
      source_file_type: body.sourceFileType,
      source_file_size: body.sourceFileSize,
      requirements_text: body.requirementsText?.trim() || '',
      pricing_profile: body.pricingProfile || null,
      status: 'requirements_ready',
    })
    if (insertError) return json({ error: 'Could not create quotation job' }, 500)

    const { data: reservation, error: reservationError } = await userClient.rpc('reserve_ai_credit', {
      p_designer_id: designer.id,
      p_job_id: jobId,
      p_idempotency_key: `reserve:${jobId}`,
    })
    if (reservationError || !reservation?.[0]) {
      await userClient.from('ai_quotation_jobs').delete().eq('id', jobId)
      const code = reservationError?.message.includes('STANDARD_SUBSCRIPTION_REQUIRED')
        ? 'STANDARD_SUBSCRIPTION_REQUIRED'
        : reservationError?.message.includes('AI_SUBSCRIPTION_REQUIRED')
          ? 'AI_SUBSCRIPTION_REQUIRED'
          : reservationError?.message.includes('AI_CREDITS_EXHAUSTED')
            ? 'AI_CREDITS_EXHAUSTED'
            : 'AI_GENERATION_UNAVAILABLE'
      return json({ error: code }, 403)
    }

    const { error: updateError } = await userClient
      .from('ai_quotation_jobs')
      .update({ credit_period_id: reservation[0].credit_period_id, status: 'queued' })
      .eq('id', jobId)
    if (updateError) return json({ error: 'Could not start quotation job' }, 500)

    return json({ jobId })
  } catch (error) {
    console.error('ai quotation create failed', error)
    return json({ error: 'Could not start AI quotation' }, 500)
  }
})
