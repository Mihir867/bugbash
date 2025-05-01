import { Octokit } from "@octokit/rest";

export async function createOctokit(accessToken) {
  return new Octokit({
    auth: accessToken,
  });
}

export async function getUserRepositories(accessToken) {
  const octokit = await createOctokit(accessToken);
  
  // Get all repositories for the authenticated user
  const { data } = await octokit.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
  });

  return data.map(repo => ({
    id: repo.id.toString(),
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    private: repo.private,
    language: repo.language,
    updated_at: repo.updated_at,
    created_at: repo.created_at,
    owner: {
      login: repo.owner.login,
      avatar_url: repo.owner.avatar_url,
    }
  }));
}

export async function getRepositoryDetails(accessToken, owner, repo) {
  const octokit = await createOctokit(accessToken);
  
  const { data } = await octokit.repos.get({
    owner,
    repo,
  });
  
  return data;
}

export async function getUserProfile(accessToken) {
  const octokit = await createOctokit(accessToken);
  
  const { data } = await octokit.users.getAuthenticated();
  
  return data;
}