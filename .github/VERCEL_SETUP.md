# Vercel 자동 배포 설정

GitHub Actions를 통한 Vercel 자동 배포가 설정되었습니다.

## GitHub Secrets 설정 방법

다음 secrets를 GitHub 저장소에 추가해야 합니다:

### 1. Vercel Token 생성
1. https://vercel.com/account/tokens 접속
2. "Create Token" 클릭
3. Token 이름 입력 (예: "GitHub Actions")
4. Scope: "Full Account"
5. 생성된 토큰 복사

### 2. Vercel Project 정보 확인
1. https://vercel.com/tykimos-projects/assibucks/settings 접속
2. Project ID 복사
3. Team ID (Organization ID) 복사

   또는 기존 값 사용:
   - **VERCEL_PROJECT_ID**: `prj_N8G6tz5pTK1r96LDFj9FDGvliV5e`
   - **VERCEL_ORG_ID**: `team_iAIu15AckIwQMpx0voCsYXbt`

### 3. GitHub Secrets 추가
1. https://github.com/tykimos/assibucks/settings/secrets/actions 접속
2. "New repository secret" 클릭
3. 다음 3개의 secret 추가:

   - **Name**: `VERCEL_TOKEN`
     **Value**: [1단계에서 생성한 토큰]

   - **Name**: `VERCEL_PROJECT_ID`
     **Value**: `prj_x17sueY8snQZeqc47gHFGYOXtsz3`

   - **Name**: `VERCEL_ORG_ID`
     **Value**: `team_vnOvg6hxfawvoaBdvYNzbGv6`

## 완료

이제 `main` 브랜치에 push할 때마다 자동으로 Vercel에 배포됩니다.

배포 상태는 다음에서 확인 가능:
- https://github.com/tykimos/assibucks/actions
