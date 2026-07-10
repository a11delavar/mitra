# Changelog

All notable changes to Mitra are documented here.

## [0.3.0] - 2026-07-10

### ✨ Features
- Redesign Logo ([d559574](https://github.com/a11delavar/mitra/commit/d55957428f92ebb2fb63921ca1beb0b6bd83081b))
- Add inline renaming of sources ([6b670e8](https://github.com/a11delavar/mitra/commit/6b670e82bd1958983f6d4de2e3ee8817dacc6d7e))
- Add vertical density zoom to the week view ([24a590c](https://github.com/a11delavar/mitra/commit/24a590c05ec85398646a59ddd136fe810f046138))
- Add inline location on the entries ([55f75e7](https://github.com/a11delavar/mitra/commit/55f75e706adc4f9aad7265970c6f8621c0953fb6))
- Add i18n infrastructure with german translations ([bfab7a7](https://github.com/a11delavar/mitra/commit/bfab7a771a4f18437be9cb62766a693edb538de2))
- Tiered and configurable logging ([24caf88](https://github.com/a11delavar/mitra/commit/24caf88ded894dd8dcc7d79fdb88c0a59077f91e))
- Add a default 30min reminder for new entries ([ae5fed6](https://github.com/a11delavar/mitra/commit/ae5fed6bceb4d04cbf241c3c0c80c79887a33038))
- Command Palette ([7df7313](https://github.com/a11delavar/mitra/commit/7df731327e1151ecc3bb6098a410360631dd6f15))
- Multi user support via OIDC ([177c95f](https://github.com/a11delavar/mitra/commit/177c95f7d84dcf994ec567b97c9c1e3ca59c125d))
- Remember the sidebar state ([02d60a9](https://github.com/a11delavar/mitra/commit/02d60a9baf55df08a6658f488a0e6cd13809affd))
- Support additional time-zones ([b16248e](https://github.com/a11delavar/mitra/commit/b16248eea372b250e7cae17c19cfa430a73f5cab))
- Add "Install as an App" button ([d9d9e05](https://github.com/a11delavar/mitra/commit/d9d9e05033e956ec7c8faf9af709945d0cc4cd5d))
- Reminders with push notifications ([c2c8854](https://github.com/a11delavar/mitra/commit/c2c8854c51537186b142818a084d1b06c600e29d))
- Location selector with support for recent and approximate locations ([adc486c](https://github.com/a11delavar/mitra/commit/adc486c47ef31fb4180c2ac86234f038f57efb35))

### ⚡ Performance
- Improve virtualization performance ([37e42ed](https://github.com/a11delavar/mitra/commit/37e42ed0a8ac5152c946a27e67ad6f7fd316eb43))

### 🐛 Bug Fixes
- Harden CalDAV sync against missing objects ([21ce421](https://github.com/a11delavar/mitra/commit/21ce421f1adaac7e991d6f09d18b5811b5de0b0e))
- Fix timezone handling for recurring all-day entries ([71c5f21](https://github.com/a11delavar/mitra/commit/71c5f21db5894aa95082382cea51ed8a13306802))
- Fix view selector not working on Chromium +150 ([74b63aa](https://github.com/a11delavar/mitra/commit/74b63aa9cb443491c77e47f3b06709f4b2c59a97))
- Task status changes on a repeating occurrence apply to just that entry ([b8e744e](https://github.com/a11delavar/mitra/commit/b8e744ecbb6237e11c28b633ea8d4373a012071a))
- Repeating entries keep their wall-clock time across DST changes ([0e001bc](https://github.com/a11delavar/mitra/commit/0e001bc7c331cb35f12f2eada2cc326fb4b4aa91))

### 🔧 Chores
- Black & white accent color ([c0448cf](https://github.com/a11delavar/mitra/commit/c0448cfef5bb29e62b3ceb91aef3338141ff4a92))

### 🧹 Refactors
- Rename technical name of month view to weeks view ([daf1d4f](https://github.com/a11delavar/mitra/commit/daf1d4f1c93c13ff96d1e9ef1708431773436f4b))
- Derive all app icons from one SVG logo ([8bde2d2](https://github.com/a11delavar/mitra/commit/8bde2d2fd2884240e80caeaa2c131ba86e3ea4d3))


## [0.2.0] - 2026-07-05


### ✨ Features
- Recurring Entries ([f87731e](https://github.com/a11delavar/mitra/commit/f87731e4595d446fa076d4d8874f3a0626862a29))
- Re-import entries from the source ([26e5918](https://github.com/a11delavar/mitra/commit/26e5918c78c172f940f67edc11fdad979bad26b6))
- Ability to migrate entries between sources ([34f23f9](https://github.com/a11delavar/mitra/commit/34f23f906461267aa09f50743a31222c04dbf160))
- Drag entries between the all-day lane and the time grid ([7d01df1](https://github.com/a11delavar/mitra/commit/7d01df1898a08d9cce1c97ca531965368b1e682f))
- Preview where an entry lands while dragging ([9f88a89](https://github.com/a11delavar/mitra/commit/9f88a8938a9ed7abb7449e7d3ef20b5ad2d77b63))
- Simplify the all-day switch ([dd2de08](https://github.com/a11delavar/mitra/commit/dd2de08bfa70cba659e8fe0dbe744e3055925889))

### 🔧 Chores
- Update dependencies ([86b3e8d](https://github.com/a11delavar/mitra/commit/86b3e8d19bbc79206fbfa62ca2322c980218454b))
## [0.1.0] - 2026-06-07


### ✨ Features
- Edit date, time, and all-day in entry details ([3a71ea3](https://github.com/a11delavar/mitra/commit/3a71ea39419519bdec8359ed13f4591718ddede5))
- Add task status indicator ([1770e97](https://github.com/a11delavar/mitra/commit/1770e970e94b48bf0ad08adf4c5da3e94334fc98))
- Choose a default source for new entries ([5355978](https://github.com/a11delavar/mitra/commit/53559781eab16fd28e28e45a4bd32f0fa638f7d3))
- Support changing entry date time via drag & drop ([66a099a](https://github.com/a11delavar/mitra/commit/66a099aa6d5cbe7c368c208f4fc8e676c4d62332))
- Add support for iCloud synchronization (#1) ([4235641](https://github.com/a11delavar/mitra/commit/4235641d4eaf2ed9334c2f560bb1c9a245711d32))
- Create entries via drag & drop ([34f1078](https://github.com/a11delavar/mitra/commit/34f10788151d3bae241113ac2850d0cfa3113c3f))
- Support selecting and syncing colors for sources and entries ([8a6b1a7](https://github.com/a11delavar/mitra/commit/8a6b1a7ad5dc68aea355213a1f7f34259165d7c8))
- Support placement of all-day entries ([ebab2a1](https://github.com/a11delavar/mitra/commit/ebab2a1eb2702e55a891509b2a15b050de305164))
- Option to delete entries ([de0951a](https://github.com/a11delavar/mitra/commit/de0951a3c02e6822295827309ac917d08f73c7c8))
- Support CalDAV tasks ([0bb8ade](https://github.com/a11delavar/mitra/commit/0bb8ade8a96dca9460ba04f81b6d09c50150fe88))
- Support markdown description ([1930d9f](https://github.com/a11delavar/mitra/commit/1930d9f702f41f84fc4add08ca659b80acf7fb61))
- Manage integrations and activate their sources ([990f6e1](https://github.com/a11delavar/mitra/commit/990f6e1c5b17cf2e7d0077a2ee2e0f40f5d727c6))
- Add two-way integration sync engine ([84b6922](https://github.com/a11delavar/mitra/commit/84b692266ab86837476d6ac759d9a6eebeed68d0))
- Add view switcher ([4652429](https://github.com/a11delavar/mitra/commit/4652429301bbe4662db2ee6467d0ca0fe7c7c063))
- Add "Today" button ([704ecd7](https://github.com/a11delavar/mitra/commit/704ecd73c62c851d0549cb41724a9979f328c983))
- Add event details overlay ([147c19c](https://github.com/a11delavar/mitra/commit/147c19c3f58c484a4314f56cd46cfa07a09b5909))
- Add ability to hide entries of a given source via the new sidebar ([1470b40](https://github.com/a11delavar/mitra/commit/1470b4043a88b734984601f5183530237debc843))
- Implement real-time updates ([98daa37](https://github.com/a11delavar/mitra/commit/98daa3760bd3909e1cbe84e3c8b59afe343e0e7d))
- Scrollable time axis ([1b96b8c](https://github.com/a11delavar/mitra/commit/1b96b8c573ca1ef8dd46f7d8a088bb0976647660))
- CalDAV one-way cache and sync engine ([870d59e](https://github.com/a11delavar/mitra/commit/870d59effdc45d044df11665d3afc840bd16300f))
- Slick design distinguishing surface and background colors ([db55922](https://github.com/a11delavar/mitra/commit/db55922a051923b0b5a45344f24248d446f3f823))
- Add current time line ([3f61baa](https://github.com/a11delavar/mitra/commit/3f61baa59a0298013f571445e9123edd927c1b26))
- View transition for events ([2ae85b3](https://github.com/a11delavar/mitra/commit/2ae85b374f278d56fe0538f18201f20497f5db6a))
- Support light and dark modes ([ad58e2a](https://github.com/a11delavar/mitra/commit/ad58e2ae930ab4b8b2b9ba3b8df6ec6c52a3812f))
- Month view with infinite scrolling ([2885781](https://github.com/a11delavar/mitra/commit/28857816b0f2b2634c633d0824fb0b4758764b0d))
- Daily calendar view with an interactive 24-hour time axis ([dea185c](https://github.com/a11delavar/mitra/commit/dea185c5483deade6f098783617469ad82895c29))

### 🏗️ Infrastructure
- Add tag-driven releases, release notes, multi-arch docker image, and GHCR publishing ([beda8ea](https://github.com/a11delavar/mitra/commit/beda8ea4de5af43d3202c79426e4788d64e97854))
- Quality Assurance workflow ([942ba04](https://github.com/a11delavar/mitra/commit/942ba044067f48957f3f0f389949ed4f8942d9b4))
- Integrate ESLint ([f018da0](https://github.com/a11delavar/mitra/commit/f018da08d9412ce15b4f66aad29c5a226959f973))
- Serve the frontend by backend instead of esbuild-server ([d2d7f15](https://github.com/a11delavar/mitra/commit/d2d7f157485e483cbe3910b62f81eeab88575db0))

### 🔧 Chores
- Preserve session cookie with API requests ([17de6a2](https://github.com/a11delavar/mitra/commit/17de6a2c099b7ca2f6a9111ac6ebbe7038932a4c))
- Add license ([09d8ec4](https://github.com/a11delavar/mitra/commit/09d8ec40fb356b82da9a4c3fa0c8bf3635e390f7))
- Update agents file ([2c3397c](https://github.com/a11delavar/mitra/commit/2c3397c413504bf34538e94cb93372300e0bf3ce))
- Prevent refetching when nothing changed ([8929a1a](https://github.com/a11delavar/mitra/commit/8929a1a36ac6cf98eeb99d2f1c7ac19dc89fa4bc))
- Enhance text color of events ([a20ae03](https://github.com/a11delavar/mitra/commit/a20ae0339dee5aefd78bb24cdcc860bbb4de9344))
- Add readme and agents files ([d45269c](https://github.com/a11delavar/mitra/commit/d45269c6c583fca422b7ca85630e6db5ca2d40b6))

### 🧹 Refactors
- Vertically slice the server modules ([5458229](https://github.com/a11delavar/mitra/commit/54582294a5a0accec491f27d02e3db0326d4e7cb))
- Separate events and event segments ([d66ac85](https://github.com/a11delavar/mitra/commit/d66ac8535042fb446e93eb7819780483dc6f8e0b))
- More streamlined layout and use light dom ([91f6fd9](https://github.com/a11delavar/mitra/commit/91f6fd90cd533427350007c4a8861818af34d496))
