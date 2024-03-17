<template>
  <div class="chat-container">
    <div class="chat-history " ref="chatHistory">
      <div v-for="(message, index) in chatHistory" :key="index" class="chat-message" :class="{ 'user': message.role === 'user', 'assistant': message.role === 'assistant' }">
        <div v-html="message.message"></div>
      </div>
    </div>
    <span class="chat-thumbnails" style="display:none"></span>
  <div class="chat-input-area">
    <label for="file-upload" class="file-upload-label">
        <i class="fas fa-paperclip"></i>
    </label>
    <input type="file" id="file-upload" @change="handleFileUpload" class="file-input" accept="image/*">
    <img v-if="imagePreview" :src="imagePreview" class="file-thumbnail" alt="Image preview">
      <textarea v-model="userInput" placeholder="Type a message..." class="chat-input" ></textarea>
      <button @click="sendMessage" class="send-button">
        <svg aria-hidden="true" class="w-6 h-6 rotate-90" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
        <span class="sr-only">Send message</span>
      </button>
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
      html: true,
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
            // If highlighting fails, escape the HTML and wrap it in code tags
            return '<pre class="hljs"><code>' +
                      str +
                    '</code></pre>';
          }
        } else {
          // If no language is specified, escape the HTML and wrap it in code tags
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
          const imgContent = `<img src="${e.target.result}" alt="${this.fileName}" style="height: 100px;width:100px">`;
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
  .chat-container {
    display: flex;
    flex-direction: column;
    width: 98vw; /* Full viewport width */
    height: 90vh; /* Full viewport height */
    margin: 0;
    box-shadow: none;
    border-radius: 5;
    overflow: hidden;
    font-family: 'Arial', sans-serif;
  }

  .chat-history {
    padding: 1rem;
    overflow-y: auto;
    background-color: white;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-grow: 1; /* Grow to use available space */
  }
  
  .chat-message {
    max-width: 80%;
    padding: 0.5rem 0.5rem;
    border-radius: 16px;
    line-height: 1.4;
  }
  
  .chat-message.user {
    align-self: flex-end;
    background-color: #dcf8c6;
    text-align: right;
  }
  
  .chat-message.assistant {
    align-self: flex-start;
    background-color: #e5e5ea;
    text-align: left;
  }
  
  .chat-input-area {
    background-color: #f0f0f0;
    padding: 1rem;
    margin-left:1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .chat-input {
    flex-grow: 1;
    padding: 0.5rem;
    border-radius: 16px;
    height: 3em;
    border: 1px solid #ccc;
  }
  
  .file-input {
    display: none;
  }
  
  .send-button {
    padding: 0.5rem 1rem;
    border-radius: 16px;
    border: none;
    background-color: #4a76a8;
    color: white;
    cursor: pointer;
  }
  
  .send-button:hover {
    background-color: #3b5a7d;
  }
  .file-upload-label {
    cursor: pointer;
    color: #4a76a8;
    margin-right: 0.5rem; /* Add some space between the upload and send buttons */
    font-size: 1.2rem; /* Adjust the size of the icon as needed */
  }

  .file-upload-label:hover {
    color: #3b5a7d;
  }

  .file-input {
    display: none; /* Keep this hidden */
  }
  .file-name-display {
    color: #555;
    margin-top: 0.5rem;
    font-size: 0.85rem;
  }
  .file-thumbnail {
    /* Set the height to match the text input height */
    height: 3em; /* Adjust as needed */
    width: auto; /* Maintain aspect ratio */
    /* Other styles as needed */
  }
</style>