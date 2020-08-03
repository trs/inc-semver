const {setFailed, setOutput} = require('@actions/core');
const {context} = require('@actions/github');
const semver = require('semver');

const { getPackageInfo } = require('./pkg');
const { fetchLatestTag, fetchCommits } = require('./gh');
const { determineReleaseType } = require('./ver');

void async function () {
  try {
    // Default output
    setOutput('latestVersion', null);
    setOutput('latestTag', null);
    setOutput('nextVersion', null);
    setOutput('nextTag', null);

    const package = await getPackageInfo();
    console.log(`Using package ${package.name}`)

    console.log('Fetching latest tag...');
    const latestTag = await fetchLatestTag(package.prefix);
    if (!latestTag) {
      console.log(`No previous tag found, defaulting to package version (${package.version}).`);

      setOutput('nextVersion', package.version);
      setOutput('nextTag', `${package.prefix}${package.version}`);
      return;
    }

    console.log(`Found tag: ${latestTag.tag} (${latestTag.version})`);

    // Set latest values
    setOutput('latestVersion', latestTag.version);
    setOutput('latestTag', latestTag.tag);

    // Find commits between latest tag and commit
    console.log(`Searching commits: ${latestTag.oid}..${context.sha}`);
    const commits = await fetchCommits(package.directory, latestTag.oid);
    console.log(`Found ${commits.length} commits`);
    console.table(commits, ['message']);

    // Determine next release type based on commit messages
    const releaseType = determineReleaseType(commits);
    if (!releaseType) {
      console.log('No commits trigger a release');
      return;
    }

    console.log(`Commits trigger a ${releaseType} release`);

    const nextVersion = semver.inc(latestTag.version, releaseType);

    setOutput('nextVersion', nextVersion);
    setOutput('nextTag', `${package.prefix}${nextVersion}`);
  } catch (err) {
    setFailed(err.message);
  }
}();
