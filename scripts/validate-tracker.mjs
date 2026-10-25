import {spawn} from 'node:child_process';
const options={cwd:'source/tracker',env:{...process.env,NITRO_PRESET:'node-server',CI:'true',NODE_ENV:'development'},shell:true,stdio:'inherit'};
const command=process.argv[2] || 'types';
const args=command==='types'?['exec','nuxt','typecheck']:command==='test'?['exec','vitest','run','app/utils/__tests__/runtimeConfig.test.ts','app/utils/__tests__/mapCoordinates.test.ts','app/utils/__tests__/taskStatus.test.ts']:['exec','eslint','app/plugins/companion.client.ts','app/types/companion.ts','app/composables/useCompanionPlayer.ts','app/composables/useLeafletMap.ts','app/features/maps/LeafletMap.vue','app/pages/companion-map.vue','app/pages/companion-settings.vue','app/components/CompanionToolbar.client.vue','app/utils/runtimeConfig.ts','nuxt.config.ts','--fix'];
const child=spawn('pnpm.cmd',args,options);child.on('exit',code=>process.exit(code ?? 1));
