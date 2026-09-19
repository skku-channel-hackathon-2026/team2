import { useCallback, useEffect, useState } from 'react'
import {
  VStack,
  HStack,
  Button,
  Text,
  TextArea,
  Tag,
  Divider,
} from '@channel.io/bezier-react/beta'
import { EmptyState, InlineBanner } from '@channel.io/app-sdk-wam-ui'
import {
  KNOWLEDGE_FUNCTIONS,
  type KnowledgeDraft,
  type KnowledgeDraftListOutput,
  type KnowledgeExportOutput,
  type KnowledgeReviewOutput,
} from '@tutorial/shared'

import { useAppFunction } from '../../hooks/useAppFunction'
import { formatDay } from '../../utils/datetime'

interface KnowledgeTabProps {
  appId: string
}

function KnowledgeTab({ appId }: KnowledgeTabProps) {
  const list = useAppFunction<KnowledgeDraftListOutput>(
    appId,
    KNOWLEDGE_FUNCTIONS.listDrafts
  )
  const review = useAppFunction<KnowledgeReviewOutput>(
    appId,
    KNOWLEDGE_FUNCTIONS.review
  )
  const exportAll = useAppFunction<KnowledgeExportOutput>(
    appId,
    KNOWLEDGE_FUNCTIONS.export
  )

  const [items, setItems] = useState<KnowledgeDraft[] | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [result, setResult] = useState('')
  const [markdown, setMarkdown] = useState('')

  const refresh = useCallback(async () => {
    const response = await list.run()
    if (response) setItems(response.items)
  }, [list])

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleReview = useCallback(
    async (draft: KnowledgeDraft, action: 'publish' | 'reject') => {
      setResult('')
      setMarkdown('')

      const edited = edits[draft.knowledgeId]?.trim()
      const response = await review.run({
        knowledgeId: draft.knowledgeId,
        action,
        ...(action === 'publish' && edited && edited !== draft.answerText
          ? { editedAnswerText: edited }
          : {}),
      })
      if (!response) return

      setResult(
        response.status === 'published'
          ? '게시했어요. 이제 같은 질문에 유사 답으로 보여요.'
          : '반려했어요.'
      )
      await refresh()
    },
    [edits, refresh, review]
  )

  const handleExport = useCallback(async () => {
    setResult('')
    const response = await exportAll.run({})
    if (!response) return
    setMarkdown(response.markdown)
    setResult(
      response.count > 0
        ? `${response.count}건을 마크다운으로 만들었어요. 도큐먼트에 붙여넣어 주세요.`
        : '내보낼 지식이 없어요.'
    )
  }, [exportAll])

  const notice = list.message || review.message || exportAll.message
  const busy = list.loading || review.loading || exportAll.loading

  return (
    <VStack spacing={12}>
      <HStack
        spacing={6}
        align="center"
      >
        <Text
          typo="16"
          bold
        >
          지식 검수
        </Text>
        {items && items.length > 0 && (
          <Tag
            size="s"
            variant="orange"
          >
            대기 {items.length}
          </Tag>
        )}
      </HStack>

      {notice && (
        <InlineBanner
          variant="error"
          content={notice}
        />
      )}
      {result && !notice && (
        <InlineBanner
          variant="success"
          content={result}
        />
      )}

      {items && items.length === 0 && (
        <EmptyState title="검수할 초안이 없어요" />
      )}

      {(items ?? []).map((draft) => (
        <VStack
          key={draft.knowledgeId}
          spacing={6}
        >
          <Divider />
          <Text
            typo="15"
            bold
          >
            {draft.questionTitle}
          </Text>
          <HStack
            spacing={4}
            align="center"
          >
            <Tag
              size="xs"
              variant="olive"
            >
              {draft.fieldLabel}
            </Tag>
            <Text
              typo="13"
              color="text-neutral-light"
            >
              {draft.authorAlias ?? '익명'} · {formatDay(draft.createdAt)}
            </Text>
          </HStack>
          <TextArea
            value={edits[draft.knowledgeId] ?? draft.answerText}
            minRows={3}
            maxRows={10}
            maxLength={2000}
            onChange={(event) =>
              setEdits((previous) => ({
                ...previous,
                [draft.knowledgeId]: event.target.value,
              }))
            }
          />
          <HStack
            spacing={6}
            justify="end"
          >
            <Button
              variant="outlined"
              semantic="secondary"
              label="반려"
              disabled={busy}
              onClick={() => void handleReview(draft, 'reject')}
            />
            <Button
              variant="filled"
              semantic="primary"
              label="게시"
              disabled={busy}
              onClick={() => void handleReview(draft, 'publish')}
            />
          </HStack>
        </VStack>
      ))}

      <Divider />
      <HStack justify="end">
        <Button
          variant="outlined"
          semantic="primary"
          label="마크다운 내보내기"
          disabled={busy}
          onClick={() => void handleExport()}
        />
      </HStack>

      {markdown && (
        <TextArea
          value={markdown}
          minRows={6}
          maxRows={16}
          readOnly
        />
      )}
    </VStack>
  )
}

export default KnowledgeTab
