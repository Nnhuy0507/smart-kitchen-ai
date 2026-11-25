
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getAuthUser, getCurrentUserId } from '../lib/auth';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ChefHat,
  Refrigerator,
  UtensilsCrossed,
  ArrowRight,
  RotateCcw,
} from 'lucide-react-native';

// GHI CHÚ: Mobile chỉ gọi backend của ứng dụng; Gemini API key được giữ ở backend/.env.
const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  `http://${Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost'}:3000`
).replace(/\/+$/, '');

const C = {
  orange: '#A23A00',
  deep: '#842D00',
  cream: '#FFF8F6',
  peach: '#FEF1EB',
  white: '#FFFFFF',
  dark: '#201A17',
  muted: '#735A51',
  border: '#EED9CF',
  green: '#397C57',
  mint: '#E9F5EB',
};

type ActionType = 'recipes' | 'meal-plan' | 'shopping-list' | 'pantry';

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  action?: ActionType;
  actionLabel?: string;
};

type IngredientInventoryParts = {
  before: string;
  ingredients: string[];
  after: string;
};

function parseIngredientInventory(content: string): IngredientInventoryParts | null {
  const match = content.match(
    /(hiện tại bạn đang có:\s*)(?:\*\*)?([^*\n]+?)(?:\*\*)?(?=[.!?\n]|$)/i
  );

  if (!match || match.index === undefined) return null;

  const ingredients = match[2]
    .split(/\s*(?:,|;|\bvà\b)\s*/i)
    .map((ingredient) => ingredient.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean);

  if (ingredients.length < 2) return null;

  const matchEnd = match.index + match[0].length;
  return {
    before: content.slice(0, match.index) + match[1],
    ingredients,
    after: content.slice(matchEnd),
  };
}

function ingredientEmoji(ingredient: string): string {
  const normalized = ingredient
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (normalized.includes('trung')) return '🥚';
  if (normalized.includes('ca chua')) return '🍅';
  if (normalized.includes('khoai tay')) return '🥔';
  if (normalized.includes('hanh tay')) return '🧅';
  if (normalized.includes('toi')) return '🧄';
  if (normalized.includes('dua leo') || normalized.includes('dua chuot')) return '🥒';
  if (normalized.includes('nho')) return '🍇';
  return '🧺';
}

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Chào bạn! 👋 Mình là trợ lý trong bếp.\n\nMình giúp bạn hiểu công thức, thay nguyên liệu, xử lý món chưa ngon và chọn món nhanh cho bữa hiện tại.\n\nBạn đang nấu món gì, hay gặp khó ở bước nào? Việc xếp lịch ăn nhiều ngày có trong mục Thực đơn.',
};

const SUGGESTIONS = [
  { id: 'salty', label: 'Canh bị mặn thì làm sao?', question: 'Tôi đang nấu canh nhưng bị mặn. Tôi nên xử lý thế nào?', icon: UtensilsCrossed },
  { id: 'substitute', label: 'Thay nguyên liệu bị thiếu', question: 'Tôi đang nấu nhưng thiếu một nguyên liệu. Bạn giúp tôi tìm nguyên liệu thay thế được không?', icon: ChefHat },
  { id: 'quick', label: 'Có trứng, nấu gì trong 15 phút?', question: 'Tôi có trứng và cà chua. Gợi ý tối đa 2 món cho bữa này, làm trong 15 phút và hướng dẫn ngắn gọn.', icon: Refrigerator },
  { id: 'technique', label: 'Làm sao chiên cá không dính?', question: 'Hướng dẫn tôi chiên cá để không bị dính chảo và nát cá.', icon: ChefHat },
  { id: 'storage', label: 'Cất thức ăn thừa thế nào?', question: 'Sau bữa ăn, tôi nên làm nguội và cất thức ăn thừa thế nào?', icon: Refrigerator },
];

export default function FloatingAIAssistant() {
  const router = useRouter();

  const [visible, setVisible] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    WELCOME,
  ]);
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (visible) {
      const timeout = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 150);

      return () => clearTimeout(timeout);
    }
  }, [messages, visible]);

  const sendLock=useRef(false);
  const messageCounter=useRef(0);
  const sendMessage = async (value?: string) => {
    const question = (value ?? input).trim();

    if (!question || sendLock.current) return;
    sendLock.current=true;

    Keyboard.dismiss();
    setInput('');

    const userMessage: ChatMessage = {
      id: `user-${++messageCounter.current}`,
      role: 'user',
      content: question,
    };

    const history = messages
      .filter((item) => item.id !== 'welcome'&&!item.id.startsWith('assistant-error-'))
      .slice(-12)
      .map(({ role, content }) => ({ role, content }));

    setMessages((previous) => [...previous, userMessage]);
    setLoading(true);
    const chatController=new AbortController();
    const chatTimeout=setTimeout(()=>chatController.abort(),60000);
    try {
      const userId = await getCurrentUserId();
      const user=await getAuthUser();
      const token = user?.token || user?.sessionToken;
      if (!token) throw new Error('Bạn cần đăng nhập trước khi trò chuyện với AI.');
      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',Authorization:`Bearer ${token}` },
        signal:chatController.signal,
        body: JSON.stringify({ message: question, history, userId }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || typeof result.reply !== 'string') {
        // GHI CHÚ: Hiển thị detail của backend ở chế độ phát triển để phân biệt lỗi DB, API key và model.
        const detail = typeof result?.detail === 'string' ? ` Chi tiết: ${result.detail}` : '';
        const errorText = `${result?.message || ''} ${detail}`;
        if (/503|UNAVAILABLE|currently experiencing high demand/i.test(errorText)) {
          throw new Error('Gemini đang quá tải tạm thời. Backend đã thử model dự phòng nhưng chưa nhận được phản hồi; bạn hãy thử gửi lại sau ít phút.');
        }
        if (/403|PERMISSION_DENIED|free tier is not available|billing/i.test(errorText)) {
          throw new Error('Gemini từ chối API key (403). Project đang dùng key chưa bật billing hoặc chưa được cấp quyền dùng Gemini API. Hãy bật billing cho đúng project trong Google AI Studio/Google Cloud, rồi khởi động lại backend.');
        }
        throw new Error(`${result?.message || `Backend trả về lỗi HTTP ${response.status}.`}${detail}`);
      }

      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${++messageCounter.current}`,
          role: 'assistant',
          content: result.reply,
          ...(result.action === 'meal-plan' && {
            action: 'meal-plan' as const,
            actionLabel: typeof result.actionLabel === 'string' ? result.actionLabel : 'Mở Thực đơn',
          }),
        },
      ]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Lỗi không xác định.';
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-error-${++messageCounter.current}`,
          role: 'assistant',
          content: `Mình chưa nhận được phản hồi từ Gemini. ${detail}`,
        },
      ]);
    } finally {
      clearTimeout(chatTimeout);
      sendLock.current=false;
      setLoading(false);
    }
  };

  const navigateTo = (action: ActionType) => {
    setVisible(false);
    Keyboard.dismiss();

    const paths: Record<ActionType, string> = {
      recipes: '/recipes',
      'meal-plan': '/meal-plan',
      'shopping-list': '/shopping-list',
      pantry: '/pantry',
    };

    router.push(paths[action] as any);
  };

  const resetChat = () => {
    setMessages([WELCOME]);
    setInput('');
  };

  return (
    <>
      {/* NÚT ROBOT NỔI */}
      <Pressable
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
        accessibilityRole="button"
        accessibilityLabel="Mở trợ lý Smart Kitchen AI"
      >
        <Bot size={29} color={C.white} strokeWidth={2.2} />

        <View style={styles.sparkleBadge}>
          <Sparkles size={12} color={C.orange} />
        </View>
      </Pressable>

      {/* CỬA SỔ TRỢ LÝ AI */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => {
              Keyboard.dismiss();
              setVisible(false);
            }}
          />

          <View style={styles.chatPanel}>
            {/* HEADER CHAT */}
            <View style={styles.chatHeader}>
              <View style={styles.avatar}>
                <Bot size={24} color={C.orange} />
              </View>

              <View style={styles.headerInfo}>
                <Text style={styles.chatTitle}>
                  Smart Kitchen AI
                </Text>

                <Text style={styles.chatSubtitle}>
                  Trợ lý nấu ăn của bạn
                </Text>
              </View>

              <Pressable
                style={styles.headerButton}
                onPress={resetChat}
              >
                <RotateCcw size={18} color={C.white} />
              </Pressable>

              <Pressable
                style={styles.headerButton}
                onPress={() => setVisible(false)}
              >
                <X size={21} color={C.white} />
              </Pressable>
            </View>

            {/* TIN NHẮN */}
            <ScrollView
              ref={scrollRef}
              style={styles.chatBody}
              contentContainerStyle={styles.chatContent}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({
                  animated: true,
                })
              }
            >
              {messages.map((message) => {
                const isUser = message.role === 'user';
                const inventory = isUser
                  ? null
                  : parseIngredientInventory(message.content);

                return (
                  <View
                    key={message.id}
                    style={[
                      styles.messageWrapper,
                      isUser
                        ? styles.userWrapper
                        : styles.assistantWrapper,
                    ]}
                  >
                    {!isUser && (
                      <View style={styles.smallAvatar}>
                        <Bot size={15} color={C.orange} />
                      </View>
                    )}

                    <View
                      style={[
                        styles.messageBubble,
                        isUser
                          ? styles.userBubble
                          : styles.assistantBubble,
                      ]}
                    >
                      {inventory ? (
                        <>
                          <Text style={styles.messageText}>{inventory.before}</Text>
                          <View style={styles.ingredientList}>
                            {inventory.ingredients.map((ingredient, index) => (
                              <View
                                key={`${ingredient}-${index}`}
                                style={styles.ingredientRow}
                              >
                                <Text style={styles.ingredientIcon}>
                                  {ingredientEmoji(ingredient)}
                                </Text>
                                <Text style={styles.ingredientName}>
                                  {ingredient}
                                </Text>
                              </View>
                            ))}
                          </View>
                          {!!inventory.after.trim() && (
                            <Text style={styles.messageText}>
                              {inventory.after.trim()}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.messageText,
                            isUser && styles.userText,
                          ]}
                        >
                          {message.content}
                        </Text>
                      )}

                      {message.action && (
                        <Pressable
                          style={styles.actionButton}
                          onPress={() =>
                            navigateTo(message.action!)
                          }
                        >
                          <Text style={styles.actionText}>
                            {message.actionLabel}
                          </Text>

                          <ArrowRight
                            size={15}
                            color={C.orange}
                          />
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}

              {loading && (
                <View style={styles.loadingRow}>
                  <ActivityIndicator
                    size="small"
                    color={C.orange}
                  />
                  <Text style={styles.loadingText}>
                    Đang suy nghĩ...
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* CÂU HỎI GỢI Ý */}
            <View style={styles.suggestionsSection}>
              <View style={styles.suggestionsHeading}>
                <Sparkles size={14} color={C.orange} />

                <Text style={styles.suggestionsTitle}>
                  Bạn có thể hỏi
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.suggestionsRow}
              >
                {SUGGESTIONS.map((suggestion) => {
                  const Icon = suggestion.icon;

                  return (
                    <Pressable
                      key={suggestion.id}
                      style={styles.suggestionChip}
                      onPress={() =>
                        sendMessage(suggestion.question)
                      }
                    >
                      <Icon size={15} color={C.orange} />

                      <Text style={styles.suggestionText}>
                        {suggestion.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Ô NHẬP CHAT */}
            <View style={styles.inputArea}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Hỏi trợ lý AI..."
                placeholderTextColor="#A18B81"
                style={styles.input}
                multiline
                maxLength={1000}
                onSubmitEditing={() => sendMessage()}
                blurOnSubmit
              />

              <Pressable
                style={[
                  styles.sendButton,
                  !input.trim() && styles.sendButtonDisabled,
                ]}
                disabled={!input.trim() || loading}
                onPress={() => sendMessage()}
              >
                <Send size={19} color={C.white} />
              </Pressable>
            </View>

            <Text style={styles.disclaimer}>
              Câu trả lời do AI tạo; vui lòng kiểm tra dị ứng và thông tin trước khi nấu.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 85,
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.orange,
    borderWidth: 3,
    borderColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    elevation: 12,
    shadowColor: '#50200D',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  sparkleBadge: {
    position: 'absolute',
    top: -5,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.peach,
    borderWidth: 2,
    borderColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(25, 15, 10, 0.48)',
  },
  chatPanel: {
    height: '79%',
    maxHeight: 700,
    backgroundColor: C.cream,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    paddingBottom: Platform.OS === 'ios' ? 18 : 8,
  },
  chatHeader: {
    backgroundColor: C.orange,
    paddingHorizontal: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  chatTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: '800',
  },
  chatSubtitle: {
    color: '#FFE8DC',
    fontSize: 11,
    marginTop: 4,
  },
  headerButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBody: {
    flex: 1,
  },
  chatContent: {
    padding: 13,
    gap: 14,
    paddingBottom: 22,
  },
  messageWrapper: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-end',
  },
  userWrapper: {
    justifyContent: 'flex-end',
  },
  assistantWrapper: {
    justifyContent: 'flex-start',
  },
  smallAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.peach,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    maxWidth: '85%',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  assistantBubble: {
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: C.orange,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 19,
    color: C.dark,
  },
  ingredientList: {
    marginTop: 7,
    marginBottom: 4,
    gap: 7,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  ingredientIcon: {
    width: 22,
    fontSize: 16,
    textAlign: 'center',
  },
  ingredientName: {
    fontSize: 12,
    lineHeight: 19,
    color: C.dark,
  },
  userText: {
    color: C.white,
  },
  actionButton: {
    marginTop: 12,
    backgroundColor: C.peach,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  actionText: {
    color: C.orange,
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 34,
  },
  loadingText: {
    fontSize: 11,
    color: C.muted,
  },
  suggestionsSection: {
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 11,
    paddingBottom: 12,
  },
  suggestionsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.dark,
  },
  suggestionsRow: {
    paddingHorizontal: 13,
    gap: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: C.peach,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  suggestionText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.orange,
  },
  inputArea: {
    backgroundColor: C.white,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 43,
    maxHeight: 95,
    backgroundColor: C.cream,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 12,
    color: C.dark,
  },
  sendButton: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: C.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  disclaimer: {
    backgroundColor: C.white,
    textAlign: 'center',
    fontSize: 9,
    color: C.muted,
    paddingVertical: 8,
  },
});
