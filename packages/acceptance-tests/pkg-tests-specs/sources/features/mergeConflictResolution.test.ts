import {Filename, ppath, xfs} from '@yarnpkg/fslib';
import {exec}                 from 'pkg-tests-core';

const LOCKFILE_1_0_0 = `
# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

no-deps@*:
  version "1.0.0"
  resolved "http://localhost:64572/no-deps/-/no-deps-1.0.0.tgz#8d556c1e3e6c953ea16689c506073d5fa26b957f"
  integrity sha1-jVVsHj5slT6hZonFBgc9X6JrlX8=
`;

const LOCKFILE_2_0_0 = `
# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1

no-deps@*:
  version "2.0.0"
  resolved "http://localhost:64572/no-deps/-/no-deps-2.0.0.tgz#f3b8f24d76b21b04748e6888672752b872236fa7"
  integrity sha1-87jyTXayGwR0jmiIZydSuHIjb6c=
`;

function cleanLockfile(lockfile: string) {
  lockfile = lockfile.replace(/(^ {2}version: )[0-9]+$/m, `$1X`);
  lockfile = lockfile.replace(/(checksum: ).*/g, `$1<checksum stripped>`);
  lockfile = lockfile.replace(/(>>>>>>>).*(\(commit-[0-9].0.0\))/g, `$1 0000000 $2`);

  return lockfile;
}

describe(`Features`, () => {
  describe(`Merge Conflict Resolution`, () => {
    test(
      `it should properly fix merge conflicts`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await run(`install`);

          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {
            dependencies: {
              [`no-deps`]: `*`,
            },
          });

          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `1.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:1.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-1.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:2.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`merge`, `1.0.0`], {cwd: path});

          await expect(exec.execFile(`git`, [`merge`, `2.0.0`], {cwd: path, env: {LC_ALL: `C`}})).rejects.toThrow(/CONFLICT/);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
          expect(cleanLockfile(lockfile)).toMatchSnapshot();

          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `it should properly fix merge conflicts when old is Yarn 1 and new is Yarn 2`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {dependencies: {[`no-deps`]: `*`}});
          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), LOCKFILE_1_0_0);

          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), LOCKFILE_2_0_0);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `yarn2`], {cwd: path});
          await run(`install`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-yarn2`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`merge`, `2.0.0`], {cwd: path});

          await expect(exec.execFile(`git`, [`merge`, `yarn2`], {cwd: path, env: {LC_ALL: `C`}})).rejects.toThrow(/CONFLICT/);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
          expect(cleanLockfile(lockfile)).toMatchSnapshot();

          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `it should support fixing rebase conflicts`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await run(`install`);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {dependencies: {[`no-deps`]: `*`}});

          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `1.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:1.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-1.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:2.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`merge`, `1.0.0`], {cwd: path});

          await expect(exec.execFile(`git`, [`rebase`, `2.0.0`], {cwd: path, env: {LC_ALL: `C`}})).rejects.toThrow(/CONFLICT/);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
          expect(cleanLockfile(lockfile)).toMatchSnapshot();

          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `it should support fixing cherry-pick conflicts`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await run(`install`);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {dependencies: {[`no-deps`]: `*`}});

          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `1.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:1.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-1.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:2.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`merge`, `1.0.0`], {cwd: path});

          await expect(exec.execFile(`git`, [`cherry-pick`, `2.0.0`], {cwd: path, env: {LC_ALL: `C`}})).rejects.toThrow(/CONFLICT/);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
          expect(cleanLockfile(lockfile)).toMatchSnapshot();

          await expect(run(`install`)).resolves.toMatchSnapshot();
        },
      ),
    );

    test(
      `it shouldn't re-fetch the lockfile metadata when performing simple merge conflict resolutions`,
      makeTemporaryEnv(
        {},
        async ({path, run, source}) => {
          await exec.execGitInit({cwd: path});

          await run(`install`);
          await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {dependencies: {[`no-deps`]: `*`}});

          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `my-commit`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `1.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:1.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-1.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`checkout`, `-b`, `2.0.0`], {cwd: path});
          await run(`set`, `resolution`, `no-deps@npm:*`, `npm:2.0.0`);
          await exec.execFile(`git`, [`add`, `-A`], {cwd: path});
          await exec.execFile(`git`, [`commit`, `-a`, `-m`, `commit-2.0.0`], {cwd: path});

          await exec.execFile(`git`, [`checkout`, `master`], {cwd: path});
          await exec.execFile(`git`, [`merge`, `1.0.0`], {cwd: path});

          await expect(exec.execFile(`git`, [`merge`, `2.0.0`], {cwd: path, env: {LC_ALL: `C`}})).rejects.toThrow(/CONFLICT/);

          const lockfile = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);
          expect(cleanLockfile(lockfile)).toMatchSnapshot();

          await expect(run(`install`, {
            enableNetwork: false,
          })).resolves.toMatchSnapshot();
        },
      ),
    );

    // TODO: Add tests for `enableMergeConflictPrompt`
  });
});
