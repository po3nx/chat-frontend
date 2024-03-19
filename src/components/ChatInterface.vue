<template>
  <div class="flex flex-col bg-gray-100 rounded-md h-screen w-screen p-5 pb-20">
    <div class="flex-grow overflow-y-auto" ref="chatHistory">
      <div v-for="(message, index) in chatHistory" :key="index" class="max-w-4/5 p-2 mb-2 rounded-lg" :class="{ 'ml-auto bg-green-200 text-right': message.role === 'user', 'mr-auto bg-gray-200 text-left': message.role === 'assistant' }">
        <div v-html="message.message"></div>
      </div>
    </div>
    <div class="fixed inset-x-0 bottom-0 m-2.5 p-2 bg-blue-200 shadow-md rounded-md ">
      <div class="flex items-center gap-2">
        <label for="file-upload" class="cursor-pointer  text-blue-500 mr-2 text-lg">
            <i class="fas fa-paperclip"></i>
        </label>
        <input type="file" id="file-upload" @change="handleFileUpload" class="hidden" accept="image/*">
        <img v-if="imagePreview" :src="imagePreview" class="h-12 w-auto" alt="Image preview">
        <textarea v-model="userInput" placeholder="Type a message..." class="flex-grow p-2 rounded-lg h-12 border border-gray-300"></textarea>
        <button @click="sendMessage" class="p-2 rounded-lg border-none bg-blue-500 text-white cursor-pointer hover:bg-blue-600">
          <svg aria-hidden="true" class="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
          <span class="sr-only">Send message</span>
        </button>
      </div>
    </div>
  </div>
</template>
  
<script>
  /* eslint-disable */
import markdownIt from 'markdown-it';
import hljs from 'highlight.js';

export default {
  data() {
    return {
      userInput: '',
      chatHistory: [],
      image: null,
      imagePreview: null,
      md: null // Add this to store the markdown-it instance
    };
  },
  mounted() {
    this.loadMessages(); // Load messages when the component is mounted
  },
  created() {
    // Initialize the markdown-it instance when the component is created
    this.md = markdownIt({
      html: false,
      xhtmlOut: false,
      breaks: false,
      langPrefix: 'language-',
      linkify: true,
      typographer: true,
      _highlight: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' +
                    hljs.highlight(lang, str, true).value +
                    '</code></pre>';
          } catch (__) {
            return '<pre class="hljs"><code>' +
                      str +
                    '</code></pre>';
          }
        } else {
          return '<pre class="hljs"><code>' +
                  str +
                  '</code></pre>';
        }
      }
    });
  },
  methods: {
    loadMessages() {
      fetch('/gpt/backend/loadmessage', {
          method: 'GET',
          credentials: 'include', // This will include cookies with the request
        })
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          throw new Error('Network response was not ok.');
        })
        .then(data => {
          data.messages.forEach((message)=>{
            this.displayResponse(message.message, message.role,);
          });
        })
        .catch(error => {
          console.error('There has been a problem with your fetch operation:', error);
        });
    },
    sendMessage() {
      const formData = new FormData();
      formData.append('text', this.userInput);
      if (this.image) {
        formData.append('image', this.image);
        const reader = new FileReader();
        reader.onload = (e) => {
          const imgContent = `<img src="${e.target.result}" alt="${this.fileName}" style="height: 200px;">`;
          this.displayResponse(imgContent, "user");
        };
        reader.readAsDataURL(this.image);
      }
      this.displayResponse(this.userInput, "user");
      this.streamAIResponse(formData);
      
    },
    
    streamAIResponse(formData) {
      const streamUrl = '/gpt/backend/messages';
      fetch(streamUrl, {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      .then(response => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        this.readStream(reader, decoder);
        
      })
      .catch(error => console.error(error))
      this.userInput = '';
      this.image = null;
      this.imagePreview = null;
    },
    readStream(reader, decoder, output = '') {
      reader.read().then(({ value, done }) => {
        if (done) {
          // Send the final bot message when the stream is finished
          const botdata = {
            "botmessage": output
          };
          const url = '/gpt/backend/savemessage';
          fetch(url, {
            method: "POST",
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(botdata)
          });
          return;
        }
        const res = decoder.decode(value);
        const arr = res.split('data: ');
        arr.splice(0, 1); // Remove the first element which is before the first 'data: '
        arr.forEach((value) => {
          if (!value.includes('DONE')) {
            try {
              const dx = JSON.parse(value);
              if (typeof(dx.choices[0].delta.content) !== 'undefined') {
                output += dx.choices[0].delta.content;
                this.displayResponse(output, "assistant");
              }

            }catch(e){
              console.error('Failed to parse JSON:', e);
            }
          }
        });
        this.readStream(reader, decoder, output);
      });
    },
    displayResponse(output, role) {
      const result = this.md.render(output);
      if (role === "assistant" ) {
        // Find the last AI message in the chat history
        const lastMsgIndex = this.chatHistory.length - 1;

        if (this.chatHistory[lastMsgIndex] && this.chatHistory[lastMsgIndex].role == "assistant") {
          // Update the last AI message if it exists and is the last item
          this.chatHistory[lastMsgIndex].message = result;
        } else {
          // Otherwise, add a new AI message
          this.chatHistory.push({ role: "assistant", message: result });
        }
      } else {
        // For user messages or finalizing the AI message, push a new entry
        this.chatHistory.push({ role:role, message: result });
      }
      
      // Vue's reactivity system should pick up the changes, but if you have issues, you can force an update
      this.chatHistory = [...this.chatHistory];
      this.scrollToBottom();
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const element = this.$refs.chatHistory;
        element.scrollTop = element.scrollHeight;
      });
    },
    handleFileUpload(event) {
      this.image = event.target.files[0];
      if (this.image && this.image.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.imagePreview = e.target.result; // Set the image preview data URL
        };
        reader.readAsDataURL(this.image);
      }else {
        // Reset the file input and alert the user if the file is not an image
        event.target.value = ''; // Reset the file input
        this.image = null;
        this.imagePreview = null;
        alert('Please select an image file.');
      }
    }
  }
};
</script>
  
<style scoped>

</style>