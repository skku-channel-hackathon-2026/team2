export interface Persona {
  id: string
  memberId: string
  name: string
  department: string
  cohort: string
  blurb: string
}

/** Stable member ids: re-booting the same persona resumes the same chats. */
export const PERSONAS: Persona[] = [
  {
    id: 'minseo',
    memberId: 'hubaego-demo-minseo',
    name: '김민서',
    department: '소프트웨어학과',
    cohort: '24학번',
    blurb: '2학년 · 첫 인턴 지원을 앞두고 있어요',
  },
  {
    id: 'jiwon',
    memberId: 'hubaego-demo-jiwon',
    name: '이지원',
    department: '경영학과',
    cohort: '26학번',
    blurb: '신입생 · 수강신청부터 막막해요',
  },
  {
    id: 'taeho',
    memberId: 'hubaego-demo-taeho',
    name: '박태호',
    department: '글로벌경제학과',
    cohort: '21학번',
    blurb: '복학생 · 대학원과 취업 사이에서 고민 중',
  },
]

export function findPersona(id: string): Persona | undefined {
  return PERSONAS.find((persona) => persona.id === id)
}
