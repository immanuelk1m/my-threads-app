import { getServerSession } from "next-auth/next"; // v4: Import getServerSession
import { authOptions } from "@/auth"; // v4: Import authOptions
import { createClient } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import Image from 'next/image'; // next/image 임포트 추가

// Supabase Admin 클라이언트 (서버 전용) - auth.ts와 중복되므로 별도 유틸리티 함수로 분리 권장
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

// Supabase 테이블 타입 정의 (선택 사항이지만 권장)
type ThreadsUser = {
    id: string;
    username: string | null;
    name: string | null;
    profile_image_url: string | null;
    biography: string | null;
    created_at: string;
    updated_at: string;
};

export default async function DashboardPage() {
    const session = await getServerSession(authOptions); // v4: Use getServerSession

    // 세션 또는 사용자 ID 없으면 로그인 페이지로 리디렉션
    if (!session?.user?.id) {
        redirect('/api/auth/signin?callbackUrl=/dashboard'); // 로그인 후 다시 대시보드로 오도록 설정
    }

    const userId = session.user.id; // Auth.js 세션에서 사용자 ID (Threads ID) 가져오기

    // Supabase에서 사용자 데이터 조회
    let threadsUserData: ThreadsUser | null = null;
    let fetchError: unknown = null; // 타입을 unknown으로 변경

    try {
        const { data, error } = await supabaseAdmin
            .from('threads_users') // 테이블 이름
            .select('*') // 모든 컬럼 선택
            .eq('threads_user_id', userId) // Filter by the 'threads_user_id' column using the Threads ID from session
            .single<ThreadsUser>(); // 단일 결과 예상 및 타입 지정

        threadsUserData = data;
        fetchError = error;
    } catch (err) {
        console.error('Supabase query failed:', err);
        fetchError = err;
    }


    // 데이터 조회 실패 시 에러 처리
    if (fetchError || !threadsUserData) {
        console.error('Error fetching threads user data from Supabase:', fetchError instanceof Error ? fetchError.message : fetchError); // instanceof Error로 타입 가드
        return (
            <div>
                <h1>Dashboard</h1>
                <p>사용자 정보를 불러오는 데 실패했습니다.</p>
                {/* 로그아웃 버튼 등 추가 가능 */}
            </div>
        );
    }

    // 조회된 사용자 정보를 화면에 표시
    return (
        <div>
            <h1>Dashboard</h1>
            <p>Welcome, {threadsUserData.username ?? 'User'}!</p>
            {threadsUserData.profile_image_url && (
                <Image // img 태그를 Image 컴포넌트로 변경
                    src={threadsUserData.profile_image_url}
                    alt={`${threadsUserData.username ?? 'User'}'s profile picture`}
                    width={100}
                    height={100}
                    style={{ borderRadius: '50%' }}
                    priority // LCP 개선을 위해 priority 추가 (선택 사항)
                />
            )}
            <h2>User Information (from Supabase):</h2>
            {/* 요구사항대로 가져온 모든 정보 표시 */}
            <pre style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
                {JSON.stringify(threadsUserData, null, 2)}
            </pre>
            {/* 로그아웃 버튼 추가 */}
            <form action={async () => {
                'use server';
                // v4: Server actions typically redirect to the signout endpoint
                redirect('/api/auth/signout');
            }}>
                <button type="submit" style={{ marginTop: '20px', padding: '10px', cursor: 'pointer' }}>
                    Logout
                </button>
            </form>
        </div>
    );
}