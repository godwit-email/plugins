import {expect,test} from "bun:test"
import {resolve} from "node:path"
const checkout=process.env.GODWIT_CHECKOUT
test.skipIf(!checkout)("built plugin runs in Godwit's actual goja sandbox",()=>{
 const built=Bun.spawnSync(["bun","run","build.ts"],{cwd:import.meta.dir});expect(built.exitCode).toBe(0)
 const host=Bun.spawnSync(["go","test","./core","-run","^TestZenFreeVM$","-count=1"],{cwd:checkout,env:{...process.env,GODWIT_ZEN_FREE_DIST:resolve(import.meta.dir,"dist")},timeout:120000})
 if(host.exitCode!==0)throw new Error(host.stdout.toString()+host.stderr.toString())
 expect(host.exitCode).toBe(0)
},125000)
