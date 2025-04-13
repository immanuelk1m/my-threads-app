'use client'; // 클라이언트 컴포넌트에서 사용

import { signIn } from 'next-auth/react'; // 클라이언트용 signIn 임포트

export default function LoginPage() {
  return (
    <div>
      <h1>Welcome</h1>
      <button
        onClick={() => signIn('threads', { callbackUrl: '/dashboard' })} // 'threads'는 provider ID, 로그인 후 대시보드로 이동
        style={{ padding: '10px 20px', cursor: 'pointer' }}
      >
        Threads로 시작하기
      </button>
    </div>
  );
}
