import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './.env') });

const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function check() {
    const { data, error } = await supabase
        .from('job_tasks')
        .select('output, id')
        .eq('task_type', 'text_generation')
        // removed status
        .not('output->textArtifactPath', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !data) {
        console.error(error);
        return;
    }

    let found = 0;
    for (const task of data) {
        const textPath = task.output?.textArtifactPath as string;
        if (textPath && textPath.includes('/overlay/')) {
            console.log('Found overlay text artifact:', textPath);
            const { data: fileData, error: fileError } = await supabase.storage
                .from('job-artifacts')
                .download(textPath);
            if (fileData) {
                const text = await fileData.text();
                console.log('--- START TEXT ---');
                console.log(text.slice(-1000));
                console.log('--- END TEXT ---');
                console.log('Testing extraction...');
                const scoreBlockRe = /^([A-Z][A-Z &\-\\.\/]+?):\s*(\d{1,3})(?:\/100)?\s*$/gmi;
                let m;
                while ((m = scoreBlockRe.exec(text)) !== null) {
                    console.log('MATCH:', m[1], m[2]);
                }
                break;
            }
        }
    }
}

check().catch(console.error);
