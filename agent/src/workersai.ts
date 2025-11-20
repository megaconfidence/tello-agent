const { data } = event;
if (typeof data === "string") {
} else {
  try {
    // // The first time you use the model, you need to accept Meta's terms and conditions
    // // Uncomment this code to agree to the terms and conditions
    // const agreeResponse = await env.AI.run(
    //   "@cf/meta/llama-3.2-11b-vision-instruct",
    //   {
    //     prompt: "agree"
    //   }
    // );
    //
    //
    const image = new Blob([data], { type: "image/png" });
    const response = await generateText({
      messages: [
        {
          content: `Analyze this frame and estimate what percentage of the total image area is filled by the "${target}". Respond only with a single integer between 0 and 100, representing the percentage. Do not include any text, explanation, or symbols.`,
          role: "system"
        },
        {
          content: [
            {
              image: await image.arrayBuffer(),
              type: "image"
            }
          ],
          role: "user"
        }
      ],
      // @ts-expect-error is it not in the types yet?
      model: workersAI("@cf/meta/llama-3.2-11b-vision-instruct")
    });

    console.log(response.text);
  } catch (error) {
    console.error(error);
  }
}
