/**
 * Script to verify DeepSeek API is working in production
 * 
 * Usage:
 *   node scripts/verify-deepseek.js <your-production-url>
 * 
 * Example:
 *   node scripts/verify-deepseek.js https://pi-cms-xyz.vercel.app
 */

const url = process.argv[2] || 'http://localhost:3000'

async function verifyDeepSeek() {
  console.log('🔍 Verifying DeepSeek API Setup...\n')
  
  // Step 1: Check health endpoint
  console.log('Step 1: Checking application health...')
  console.log(`Testing: ${url}/api/health\n`)

  try {
    const healthResponse = await fetch(`${url}/api/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const healthData = await healthResponse.json()

    if (healthData.status === 'ok') {
      console.log('✅ Application is running')
      console.log(`   AI configured: ${healthData.services.ai.configured}`)
      console.log(`   Provider: ${healthData.services.ai.provider}`)
      console.log(`   Model: ${healthData.services.ai.model || 'N/A'}`)
      console.log(`   Database: ${healthData.services.database?.configured ? '✅' : '❌'}`)
      console.log(`   Auth: ${healthData.services.auth.configured ? '✅' : '❌'}\n`)
      
      if (!healthData.services.ai.configured) {
        console.log('❌ FAILED: AI is not configured\n')
        console.log('Please check:')
        console.log('  1. DEEPSEEK_API_KEY or OPENAI_API_KEY is set in environment variables')
        console.log('  2. Redeploy after adding the key')
        process.exit(1)
      }
    } else {
      console.log('❌ Application health check failed\n')
      console.log(`Error: ${healthData.message}`)
      process.exit(1)
    }
  } catch (error) {
    console.log('❌ ERROR: Could not connect to health endpoint\n')
    console.log(`Error: ${error.message}\n`)
    console.log('Please check:')
    console.log(`  1. The URL is correct: ${url}`)
    console.log('  2. The application is deployed and accessible')
    console.log('  3. You have internet connectivity')
    process.exit(1)
  }

  // Step 2: Test AI functionality
  console.log('Step 2: Testing AI functionality...')
  console.log(`Testing: ${url}/api/ai/status\n`)

  try {
    const aiResponse = await fetch(`${url}/api/ai/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const aiData = await aiResponse.json()

    if (aiData.status === 'operational') {
      console.log('✅ SUCCESS! DeepSeek/AI is working correctly!\n')
      console.log(`Provider: ${aiData.provider}`)
      console.log(`Model: ${aiData.model}`)
      console.log(`Response Time: ${aiData.responseTime}`)
      console.log(`\nTest Response Preview:`)
      console.log(`"${aiData.testResponse}"\n`)
      console.log('🎉 Your AI integration is ready to use!')
      console.log('\nNext Steps:')
      console.log(`1. Login at: ${url}/auth/login`)
      console.log(`2. Go to: ${url}/ai/coaching`)
      console.log('3. Ask a question and verify the response!')
      process.exit(0)
    } else {
      console.log('❌ FAILED: AI is not working correctly\n')
      console.log(`Status: ${aiData.status}`)
      console.log(`Message: ${aiData.message}`)
      if (aiData.error) {
        console.log(`Error: ${aiData.error}`)
      }
      if (aiData.details) {
        console.log(`Details: ${aiData.details}\n`)
      }
      console.log('Please check:')
      console.log('  1. DEEPSEEK_API_KEY is set correctly in Vercel')
      console.log('  2. The API key is valid and has credits')
      console.log('  3. DeepSeek API is accessible from your deployment region')
      console.log('\nCheck your DeepSeek dashboard: https://platform.deepseek.com/usage')
      process.exit(1)
    }
  } catch (error) {
    console.log('❌ ERROR: Could not test AI functionality\n')
    console.log(`Error: ${error.message}\n`)
    console.log('The application is running but AI testing failed.')
    console.log('This might indicate an API configuration issue.')
    process.exit(1)
  }
}

verifyDeepSeek()
